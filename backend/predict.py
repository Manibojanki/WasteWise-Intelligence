
import json
from pathlib import Path

import numpy as np
from PIL import Image
from tensorflow.keras.models import load_model
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input


# --------------------------------------------------
# PROJECT PATHS
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"

MODEL_PATH = MODEL_DIR / "wastewise_mobilenetv2_head.keras"
CONFIG_PATH = MODEL_DIR / "model_config.json"


# --------------------------------------------------
# LOAD MODEL CONFIGURATION
# --------------------------------------------------

with open(CONFIG_PATH, "r", encoding="utf-8") as file:
    config = json.load(file)

CLASS_NAMES = config["class_names"]
IMAGE_SIZE = tuple(config["image_size"])

CONFIDENCE_THRESHOLD = float(
    config["confidence_threshold"]
)

MODEL_VERSION = config["model_version"]


# --------------------------------------------------
# LOAD MODEL ONCE WHEN BACKEND STARTS
# --------------------------------------------------

model = load_model(MODEL_PATH)


# --------------------------------------------------
# WASTE PREDICTION FUNCTION
# --------------------------------------------------

def predict_waste(image_path):

    # Open and prepare image
    with Image.open(image_path) as image:
        image = image.convert("RGB")

        image = image.resize(
            (IMAGE_SIZE[1], IMAGE_SIZE[0])
        )

        image_array = np.array(
            image,
            dtype=np.float32
        )

    # Apply the same preprocessing used during training
    image_array = np.expand_dims(
        image_array,
        axis=0
    )

    image_array = preprocess_input(image_array)

    # Generate predictions
    predictions = model.predict(
        image_array,
        verbose=0
    )[0]

    # Sort prediction indices by confidence
    sorted_indices = np.argsort(predictions)[::-1]

    # Get top three predictions
    top_predictions = []

    for index in sorted_indices[:3]:

        confidence = float(predictions[index])

        top_predictions.append({
            "category": CLASS_NAMES[int(index)],
            "confidence": round(confidence, 4),
            "confidence_percentage": round(
                confidence * 100,
                2
            )
        })

    # Get highest-confidence prediction
    predicted_index = int(sorted_indices[0])

    confidence = float(
        predictions[predicted_index]
    )

    predicted_class = CLASS_NAMES[predicted_index]

    # Determine whether manual review is required
    review_required = (
        confidence < CONFIDENCE_THRESHOLD
    )

    status = (
        "manual_review"
        if review_required
        else "classified"
    )

    # Return complete prediction information
    return {
        "predicted_class": predicted_class,
        "confidence": round(confidence, 4),
        "confidence_percentage": round(
            confidence * 100,
            2
        ),
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "review_required": review_required,
        "status": status,
        "model_version": MODEL_VERSION,
        "top_predictions": top_predictions
    }
