
import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)

from preprocessing import preprocess_image_batch

# Project paths
ROOT_DIR = Path(__file__).resolve().parent.parent
TEST_DIR = ROOT_DIR / "dataset_split" / "test"
MODEL_PATH = ROOT_DIR / "models" / "wastewise_mobilenetv2_head.keras"
CONFIG_PATH = ROOT_DIR / "models" / "model_config.json"

BATCH_SIZE = 8


def main():
    # Load model configuration
    with open(CONFIG_PATH, "r", encoding="utf-8") as file:
        config = json.load(file)

    class_names = config["class_names"]

    print("Loading trained model...")
    model = tf.keras.models.load_model(MODEL_PATH)

    image_paths = []
    true_labels = []

    # Collect test images in the same class order as training
    for class_index, class_name in enumerate(class_names):
        class_dir = TEST_DIR / class_name

        for image_path in sorted(class_dir.glob("*")):
            if image_path.suffix.lower() in {".jpg", ".jpeg", ".png"}:
                image_paths.append(image_path)
                true_labels.append(class_index)

    if not image_paths:
        raise ValueError(f"No test images found in {TEST_DIR}")

    print(f"Test images found: {len(image_paths)}")

    predictions = []

    # Predict in small batches to limit memory usage
    for start in range(0, len(image_paths), BATCH_SIZE):
        batch_paths = image_paths[start:start + BATCH_SIZE]
        batch = preprocess_image_batch(batch_paths)

        batch_predictions = model.predict(batch, verbose=0)
        predictions.extend(np.argmax(batch_predictions, axis=1))

        print(
            f"Processed {min(start + BATCH_SIZE, len(image_paths))}"
            f"/{len(image_paths)} images"
        )

    true_labels = np.array(true_labels)
    predictions = np.array(predictions)

    # Calculate evaluation metrics
    accuracy = accuracy_score(true_labels, predictions)

    print("\n========== TEST RESULTS ==========")
    print(f"Test accuracy: {accuracy:.4f} ({accuracy * 100:.2f}%)")

    print("\nClassification Report:")
    report = classification_report(
        true_labels,
        predictions,
        labels=list(range(len(class_names))),
        target_names=class_names,
        zero_division=0,
    )
    print(report)

    print("Confusion Matrix:")
    matrix = confusion_matrix(
        true_labels,
        predictions,
        labels=list(range(len(class_names))),
    )
    print(matrix)

    # Save results
    results_dir = ROOT_DIR / "models"
    results_dir.mkdir(exist_ok=True)

    report_data = classification_report(
        true_labels,
        predictions,
        labels=list(range(len(class_names))),
        target_names=class_names,
        output_dict=True,
        zero_division=0,
    )

    results = {
        "model_version": config.get("model_version", "1.0.0"),
        "test_image_count": len(image_paths),
        "test_accuracy": float(accuracy),
        "classification_report": report_data,
        "confusion_matrix": matrix.tolist(),
        "class_names": class_names,
    }

    results_path = results_dir / "evaluation_results.json"

    with open(results_path, "w", encoding="utf-8") as file:
        json.dump(results, file, indent=4)

    print(f"\nEvaluation results saved to: {results_path}")


if __name__ == "__main__":
    main()
