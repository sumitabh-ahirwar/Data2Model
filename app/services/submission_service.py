import cloudinary
import cloudinary.uploader
import io
import pandas as pd
from fastapi import UploadFile, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from app.models.submission_model import SubmissionModel
from app.schemas.submission_schema import SubmissionResponse
from app.utils.pipeline import SmartAutoPipeline
from app.config import settings

# Configure Cloudinary globally
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET
)

class SubmissionService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db["submissions"]

    async def create_submission(
        self, user_id: str, file: UploadFile, target_column: str, use_case: str, requirement: str
    ) -> SubmissionResponse:
        
        # 1. Read the file buffer
        file_content = await file.read()
        
        # 2. Convert to DataFrame and apply Pipeline
        try:
            df = pd.read_csv(io.BytesIO(file_content), low_memory=True)
            if df.empty:
                raise HTTPException(status_code=400, detail="CSV file contains no data.")
                
            # Early Validation: Check if the target exists
            if target_column:
                normalized_columns = df.columns.str.lower().str.replace(r'\s+', '_', regex=True)
                normalized_target = target_column.lower().replace(' ', '_')
                if normalized_target not in normalized_columns:
                    raise HTTPException(status_code=400, detail=f"Target column '{target_column}' not found in dataset")

            # Run Smart Pipeline
            pipeline = SmartAutoPipeline(df, target=target_column)
            pipeline.clean_columns()
            pipeline.analyze()
            pipeline.handle_missing()
            pipeline.encode()
            pipeline.handle_outliers()
            pipeline.scale()

            cleaned_df = pipeline.get_data()
            
            # Note: getting CSV back out 
            cleaned_csv_string = cleaned_df.to_csv(index=False)
            file_content_to_upload = cleaned_csv_string.encode('utf-8')
            
        except pd.errors.EmptyDataError:
            raise HTTPException(status_code=400, detail="CSV file is empty or formatted incorrectly.")
        except HTTPException as http_e:
            raise http_e
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Pipeline processing failed: {str(e)}")
            
        # 3. Upload to Cloudinary with Retry Logic
        import time
        max_retries = 3
        for attempt in range(max_retries):
            try:
                upload_result = cloudinary.uploader.upload_large(
                    io.BytesIO(file_content_to_upload), 
                    resource_type="raw", # raw is best for CSV/JSON files
                    folder="user_datasets",
                    public_id=f"{user_id}_{file.filename}"
                )
                break # Success!
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(2) # Wait 2 seconds before retrying
                    continue
                raise HTTPException(status_code=500, detail=f"Cloudinary upload failed after {max_retries} attempts: {str(e)}")

        dataset_url = upload_result.get("secure_url")

        # 4. Save metadata to MongoDB
        new_submission = SubmissionModel(
            user_id=user_id,
            dataset_url=dataset_url,
            target_column=target_column,
            use_case=use_case,
            requirement=requirement
        )
        
        sub_dict = new_submission.model_dump(by_alias=True, exclude_none=True)
        result = await self.collection.insert_one(sub_dict)
        
        sub_dict["_id"] = str(result.inserted_id)
        return SubmissionResponse(**sub_dict)

    async def get_user_submissions(self, user_id: str) -> list[SubmissionResponse]:
        cursor = self.collection.find({"user_id": user_id})
        submissions = await cursor.to_list(length=100)
        return [SubmissionResponse(**{**sub, "_id": str(sub["_id"])}) for sub in submissions]

    async def get_submission(self, submission_id: str) -> dict:
        try:
            sub = await self.collection.find_one({"_id": ObjectId(submission_id)})
            return sub
        except Exception:
            return None

    async def update_submission_status(self, submission_id: str, status: str):
        await self.collection.update_one(
            {"_id": ObjectId(submission_id)},
            {"$set": {"status": status}}
        )

    async def save_trained_model(self, submission_id: str, model_bytes: bytes, config_dict: dict):
        await self.collection.update_one(
            {"_id": ObjectId(submission_id)},
            {"$set": {
                "status": "completed",
                "model_artifact": model_bytes,
                "model_config_json": config_dict
            }}
        )
