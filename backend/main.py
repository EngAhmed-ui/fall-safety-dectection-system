from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import cv2
import numpy as np
import time

# 1. Initialize FastAPI application
app = FastAPI(title="Fall Detection API")

# 2. Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Load the YOLO model (Ensure 'best.pt' is in the backend folder)
model = YOLO('best_v2.pt')

# 4. Create the API Endpoint
@app.post("/detect/")
async def detect_fall(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # Start timing the inference
    start_time = time.time()
    
    results = model.predict(source=img, conf=0.5, verbose=False)
    
    # Calculate processing time
    process_time = round(time.time() - start_time, 2)

    fall_detected = False
    boxes_data = []

    for box in results[0].boxes:
        class_id = int(box.cls[0])
        class_name = model.names[class_id]
        x1, y1, x2, y2 = map(int, box.xyxy[0])

        if "fall" in class_name.lower():
            fall_detected = True

        boxes_data.append({
            "class_name": class_name,
            "confidence": round(float(box.conf[0]), 2),
            "x1": x1,
            "y1": y1,
            "x2": x2,
            "y2": y2
        })

    return {
        "fall_detected": fall_detected,
        "boxes": boxes_data,
        "processing_time": process_time
    }