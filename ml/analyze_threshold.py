
import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from sklearn.metrics import accuracy_score

from preprocessing import preprocess_image_batch

ROOT_DIR = Path(__file__).resolve().parent.parent
VALIDATION_DIR = ROOT_DIR / "dataset_split" / "validation"
MODEL_PATH = ROOT_DIR / "models" / "wastewise_mobilenetv2_head.keras"
CONFIG_PATH = ROOT_DIR / "models" / "model_config.json"

BATCH_SIZE = 8

# Candidate thresholds for manual review
THRESHOLDS = [0.40, 0.50, 0.60, 0.70, 0.80]


def main():
    with open(CONFIG_PATH, "r", encoding="utf-8") as file:
        config = json.load(file)

    class_names = config["class_names"]

    print("Loading trained model...")
    model = tf.keras.models.load_model(MODEL_PATH)

    image_paths = []
    true_labels = []

    for class_index, class_name in enumerate(class_names):
        class_dir = VALIDATION_DIR / class_name

        for image_path in sorted(class_dir.glob("*")):
            if image_path.suffix.lower() in {".jpg", ".jpeg", ".png"}:
                image_paths.append(image_path)
                true_labels.append(class_index)

    if not image_paths:
        raise ValueError("No validation images found.")

    true_labels = np.array(true_labels)
    all_scores = []

    print(f"Validation images found: {len(image_paths)}")

    for start in range(0, len(image_paths), BATCH_SIZE):
        batch_paths = image_paths[start:start + BATCH_SIZE]
        batch = preprocess_image_batch(batch_paths)

        scores = model.predict(batch, verbose=0)
        all_scores.extend(scores)

        print(
            f"Processed {min(start + BATCH_SIZE, len(image_paths))}"
            f"/{len(image_paths)} images"
        )

    all_scores = np.array(all_scores)
    predicted_labels = np.argmax(all_scores, axis=1)
    confidence_scores = np.max(all_scores, axis=1)

    normal_accuracy = accuracy_score(true_labels, predicted_labels)

    print("\n========== THRESHOLD ANALYSIS ==========")
    print(f"Normal validation accuracy: {normal_accuracy:.4f}")
    print("\nThreshold | Auto coverage | Auto accuracy | Review rate")

    threshold_results = []

    for threshold in THRESHOLDS:
        accepted = confidence_scores >= threshold
        review_rate = 1.0 - np.mean(accepted)

        if np.any(accepted):
            auto_accuracy = accuracy_score(
                true_labels[accepted],
                predicted_labels[accepted],
            )
        else:
            auto_accuracy = 0.0

        coverage = np.mean(accepted)

        print(
            f"{threshold:.2f}      | "
            f"{coverage * 100:6.2f}%       | "
            f"{auto_accuracy * 100:6.2f}%       | "
            f"{review_rate * 100:6.2f}%"
        )

        threshold_results.append({
            "threshold": threshold,
            "auto_coverage": float(coverage),
            "auto_accuracy": float(auto_accuracy),
            "review_rate": float(review_rate),
        })

    results = {
        "validation_image_count": len(image_paths),
        "normal_validation_accuracy": float(normal_accuracy),
        "threshold_results": threshold_results,
    }

    results_path = ROOT_DIR / "models" / "threshold_analysis.json"

    with open(results_path, "w", encoding="utf-8") as file:
        json.dump(results, file, indent=4)

    print(f"\nResults saved to: {results_path}")


if __name__ == "__main__":
    main()
