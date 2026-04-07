import streamlit as st
import requests

API_URL = "http://localhost:8000"

st.set_page_config(page_title="Dataset Hub", page_icon="🚀", layout="wide")

# Custom CSS for Premium Look
st.markdown("""
<style>
    .stApp {
        background-color: #0E1117;
    }
    .main-header {
        font-family: 'Inter', sans-serif;
        color: #ffffff;
        text-align: center;
        background: linear-gradient(90deg, #4b6cb7 0%, #182848 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        padding-bottom: 20px;
        font-size: 3rem !important;
        font-weight: 800;
    }
    .stButton>button {
        background-color: #4CAF50;
        color: white;
        border-radius: 8px;
        padding: 10px 24px;
        transition: all 0.3s;
        border: none;
        width: 100%;
    }
    .stButton>button:hover {
        background-color: #45a049;
        transform: scale(1.02);
    }
</style>
""", unsafe_allow_html=True)

if "access_token" not in st.session_state:
    st.session_state.access_token = None

def get_headers():
    return {"Authorization": f"Bearer {st.session_state.access_token}"}

# ----------------- SIDEBAR AUTH -----------------
with st.sidebar:
    st.title("🛡️ Authentication")
    
    if st.session_state.access_token:
        st.success("✅ Logged in")
        if st.button("Logout"):
            st.session_state.access_token = None
            st.rerun()
    else:
        auth_mode = st.radio("Choose Action", ["Login", "Register"], horizontal=True)
        
        if auth_mode == "Login":
            username = st.text_input("Username")
            password = st.text_input("Password", type="password")
            if st.button("Login"):
                res = requests.post(
                    f"{API_URL}/auth/login",
                    data={"username": username, "password": password}
                )
                if res.status_code == 200:
                    st.session_state.access_token = res.json()["access_token"]
                    st.success("Logged in successfully!")
                    st.rerun()
                else:
                    st.error("Invalid credentials.")
        
        elif auth_mode == "Register":
            username = st.text_input("New Username")
            email = st.text_input("Email")
            password = st.text_input("New Password", type="password")
            if st.button("Register"):
                res = requests.post(
                    f"{API_URL}/auth/register",
                    json={"username": username, "email": email, "password": password}
                )
                if res.status_code == 201:
                    st.success("Registered successfully! Please login.")
                else:
                    try:
                        error_msg = res.json().get("detail", "Registration failed.")
                    except ValueError:
                        error_msg = f"Registration failed. Server returned {res.status_code}"
                    st.error(error_msg)

# ----------------- MAIN APP -----------------
st.markdown("<h1 class='main-header'>Neural Network Project Request Hub</h1>", unsafe_allow_html=True)

if not st.session_state.access_token:
    st.info("### 👋 Welcome! \nPlease log in using the sidebar on the left to submit your dataset and requirements.")
else:
    tab1, tab2 = st.tabs(["🚀 Submit New Request", "📂 My Submissions"])
    
    with tab1:
        st.markdown("### 📤 Upload Your Dataset & Requirements")
        st.write("Fill out the details below to define the architecture and expectations you have from the model.")
        
        with st.container():
            with st.form("submission_form", border=True):
                dataset_file = st.file_uploader("Upload Dataset (CSV limits apply)", type=["csv", "txt"])
                target_column = st.text_input("🎯 Target Column Name", placeholder="e.g. Sales, Price, Quality")
                use_case = st.text_area("💼 Use Case Description", placeholder="Describe the business scenario where this model will be used.")
                requirement = st.text_area("📋 Specific Requirements", placeholder="List any particular nuances needed in the model output or architecture.")
                
                submitted = st.form_submit_button("Submit Request 🚀")
                
                if submitted:
                    if not dataset_file or not target_column or not use_case or not requirement:
                        st.error("⚠️ Please fill out all fields and upload a dataset.")
                    else:
                        with st.spinner("⏳ Uploading directly to Cloudinary and securing metadata... (this may take a few moments)"):
                            # Prepare the multipart payload
                            files = {"dataset": (dataset_file.name, dataset_file, dataset_file.type)}
                            data = {
                                "target_column": target_column,
                                "use_case": use_case,
                                "requirement": requirement
                            }
                            
                            try:
                                # Send to FastAPI
                                res = requests.post(f"{API_URL}/submit/", headers=get_headers(), files=files, data=data)
                                if res.status_code == 200:
                                    st.success("🎉 Successfully submitted request! Your dataset is backed up securely to Cloudinary.")
                                    st.json(res.json())
                                    st.balloons()
                                else:
                                    st.error(f"❌ Error submitting request: {res.text}")
                            except requests.exceptions.ConnectionError:
                                st.error("🔌 Could not connect to the Backend API. Ensure it is running on port 8000.")

    with tab2:
        st.markdown("### 📊 My Past Submissions")
        btn_col, _ = st.columns([1, 4])
        if btn_col.button("🔄 Refresh"):
            st.rerun()

        try:
            res = requests.get(f"{API_URL}/submit/", headers=get_headers())
            if res.status_code == 200:
                submissions = res.json()
                if not submissions:
                    st.info("You haven't submitted any datasets yet.")
                else:
                    for sub in sorted(submissions, key=lambda x: x.get('created_at', ''), reverse=True):
                        # Ensure we always stringify _id reliably for keys
                        sub_id = str(sub.get('_id', sub.get('id', ''))) 
                        status = sub.get('status', 'pending')
                        
                        with st.expander(f"Dataset: {sub['target_column']} | Status: {status.upper()}"):
                            st.write(f"**Use Case:** {sub['use_case']}")
                            st.write(f"**Requirement:** {sub['requirement']}")
                            st.write(f"**Dataset URL:** [Download Data]({sub['dataset_url']})")
                            st.write(f"**Submitted At:** {sub['created_at']}")
                            
                            if status in ['pending', 'failed']:
                                if st.button("🚀 Train Model", key=f"train_{sub_id}"):
                                    t_res = requests.post(f"{API_URL}/submit/{sub_id}/train", headers=get_headers())
                                    if t_res.status_code == 200:
                                        st.success("Training started in the background! Please refresh the page in a few minutes.")
                                    else:
                                        st.error(f"Error starting training: {t_res.text}")
                            
                            elif status == 'training':
                                st.info("⏳ Model is currently training...")
                                
                            elif status == 'completed':
                                st.success("✅ Training Completed")
                                d_res = requests.get(f"{API_URL}/submit/{sub_id}/download", headers=get_headers())
                                if d_res.status_code == 200:
                                    st.download_button(
                                        label="📦 Download Trained Model & Config ZIP",
                                        data=d_res.content,
                                        file_name=f"{sub['target_column'].replace(' ', '_').lower()}_artifacts.zip",
                                        mime="application/zip",
                                        key=f"download_{sub_id}"
                                    )
                                else:
                                    st.error("Model artifacts not available right now.")
                                    
                                st.divider()
                                st.markdown("#### 🧪 Test This Model")
                                st.write("Upload a sample CSV file with the same features to get predictions.")
                                test_file = st.file_uploader("Upload Test CSV", type=["csv"], key=f"test_{sub_id}")
                                
                                if test_file is not None:
                                    if st.button("🔮 Generate Predictions", key=f"pred_btn_{sub_id}"):
                                        with st.spinner("Wait for it... Running Inference..."):
                                            files = {"test_data": (test_file.name, test_file, test_file.type)}
                                            p_res = requests.post(f"{API_URL}/submit/{sub_id}/predict", headers=get_headers(), files=files)
                                            
                                            if p_res.status_code == 200:
                                                st.success("Predictions generated successfully!")
                                                # Convert CSV bytes back to dataframe to show nicely in UI
                                                import pandas as pd
                                                import io
                                                df_preds = pd.read_csv(io.BytesIO(p_res.content))
                                                st.dataframe(df_preds)
                                                
                                                st.download_button(
                                                    label="⬇️ Download Predictions CSV",
                                                    data=p_res.content,
                                                    file_name=f"predictions_{test_file.name}",
                                                    mime="text/csv",
                                                    key=f"dl_pred_{sub_id}"
                                                )
                                            else:
                                                st.error(f"Error making predictions: {p_res.text}")
            else:
                st.error("Failed to load submissions.")
        except requests.exceptions.ConnectionError:
            st.error("🔌 Could not connect to the Backend API. Ensure it is running on port 8000.")
