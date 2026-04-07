import os
import io
import sys
import json
import urllib.request
import pandas as pd
import numpy as np
import torch
from sklearn.preprocessing import StandardScaler

# Ensure Model_Training is in sys.path so we can import DynamicMLP
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, "../../"))
model_training_path = os.path.join(project_root, "Model_Training")
if model_training_path not in sys.path:
    sys.path.append(model_training_path)

from OptunaOptimizer.MLP import DynamicMLP

def run_prediction_pipeline(submission_id: str, submission: dict, sample_bytes: bytes) -> dict:
    """
    Given the model artifacts and sample data bytes, run prediction:
    1. Downloads original dataset to train scalers based on its data distribution.
    2. Aligns the sample dataset.
    3. Runs inference.
    """
    target_col = submission["target_column"]
    model_bytes = submission["model_artifact"]
    config_dict = submission["model_config_json"]
    dataset_url = submission["dataset_url"]

    # 1. Read sample dataset
    df_sample = pd.read_csv(io.BytesIO(sample_bytes))
    
    # 2. Download original dataset
    local_orig = f"/tmp/{submission_id}_orig.csv"
    urllib.request.urlretrieve(dataset_url, local_orig)
    df_orig = pd.read_csv(local_orig)

    # 3. Preprocess Original Dataset (same logic as PrepareDataset.py)
    df_orig_prep, X_orig_cols = _preprocess_features(df_orig, target_col, is_training=True)
    X_orig = df_orig_prep.drop(columns=[target_col], errors='ignore').values
    y_orig = df_orig[target_col].values

    scaler_X = StandardScaler()
    scaler_X.fit(X_orig)
    
    scaler_y = StandardScaler()
    scaler_y.fit(y_orig.reshape(-1, 1))

    # 4. Preprocess Sample Dataset
    df_sample_prep, _ = _preprocess_features(df_sample, target_col, is_training=False, expected_cols=X_orig_cols)
    
    # Scale test data
    X_sample = df_sample_prep.values
    X_sample_scaled = scaler_X.transform(X_sample)

    # 5. Load Model Architecture & Weights
    input_dim = X_sample_scaled.shape[1]
    input_state = config_dict["input_state"]
    best_params = config_dict["best_params"]
    output_dim = input_state["model_spec"]["output_dim"]

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = DynamicMLP(input_dim, output_dim, best_params)

    with io.BytesIO(model_bytes) as m_bytes:
        # Load weights safely
        state_dict = torch.load(m_bytes, map_location=device, weights_only=True)
        model.load_state_dict(state_dict)

    model.to(device)
    model.eval()

    # 6. Run Inference
    X_tensor = torch.FloatTensor(X_sample_scaled).to(device)
    with torch.no_grad():
        predictions_scaled = model(X_tensor).cpu().numpy().flatten()
    
    # Inverse transform
    predictions = scaler_y.inverse_transform(predictions_scaled.reshape(-1, 1)).flatten()

    # Remove temporary original file
    if os.path.exists(local_orig):
        os.remove(local_orig)

    # Attach predictions to new DF for easy CSV reporting
    df_sample[f"Predicted_{target_col}"] = predictions

    # Return CSV string
    return {"predictions_csv": df_sample.to_csv(index=False)}

def _preprocess_features(df: pd.DataFrame, target_col: str, is_training: bool, expected_cols: list = None):
    # Expand Date Features
    for col in list(df.columns):
        if col == target_col:
            continue
        if not pd.api.types.is_numeric_dtype(df[col]):
            try:
                # Same check as PrepareDataset.py
                pd.to_datetime(df[col].dropna().head(), format='mixed')
                dt = pd.to_datetime(df[col], format='mixed', errors="coerce")
                df = df.drop(columns=[col])
                df.insert(0, f"{col}_year", dt.dt.year)
                df.insert(1, f"{col}_month", dt.dt.month)
                df.insert(2, f"{col}_day", dt.dt.day)
                df.insert(3, f"{col}_weekday", dt.dt.weekday)
            except (ValueError, TypeError, Exception):
                pass
                
    # Dummies
    cat_cols = [c for c in df.columns if c != target_col and not pd.api.types.is_numeric_dtype(df[c])]
    if cat_cols:
        df = pd.get_dummies(df, columns=cat_cols, drop_first=True, dtype=float)

    if not is_training and target_col in df.columns:
        df = df.drop(columns=[target_col])

    # Median filling
    df = df.fillna(df.median(numeric_only=True))

    if is_training:
        cols = [c for c in df.columns if c != target_col]
        return df, cols
    else:
        # Reindex to match training columns
        df = df.reindex(columns=expected_cols, fill_value=0)
        return df, None
