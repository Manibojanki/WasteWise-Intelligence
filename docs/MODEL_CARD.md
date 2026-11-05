
# WasteWise Intelligence – Model Card

## 1. Model Overview

- Model name: MobileNetV2
- Model version: 1.0.0
- Project: WasteWise Intelligence
- Task: Household waste image classification
- Framework: TensorFlow / Keras
- Input image size: 224 × 224 pixels
- Input format: RGB
- Output: Six waste categories

## 2. Supported Categories

The model classifies images into:

1. Cardboard
2. Glass
3. Metal
4. Paper
5. Plastic
6. Trash

## 3. Dataset Information

- Dataset: TrashNet
- Source: https://github.com/garythung/trashnet
- Original image count: 2,527
- Images retained after duplicate-label review: 2,524
- Training images: 1,766
- Validation images: 379
- Test images: 379
- Random seed: 42

The dataset primarily contains waste items photographed against white backgrounds. It may not represent all real-world waste conditions.

## 4. Preprocessing

- Convert images to RGB.
- Resize images to 224 × 224.
- Apply MobileNetV2 preprocess_input.
- Use the same preprocessing approach for training and inference.

## 5. Training Configuration

- Architecture: MobileNetV2 pretrained on ImageNet
- Training strategy: Frozen backbone with a new classification head
- Optimizer: Adam
- Learning rate: 0.001
- Batch size: 8
- Maximum epochs: 5
- Loss function: Sparse categorical crossentropy
- Output activation: Softmax
- Class weighting: Used to address class imbalance
- Data augmentation: Random horizontal flip and rotation

## 6. Evaluation Results

### Training

- Final training accuracy: 86.24%
- Final validation accuracy: 82.06%

### Independent Test Set

- Test images: 379
- Test accuracy: 81.79%
- Macro F1-score: 0.80
- Weighted F1-score: 0.82

### Per-Class F1-score

| Category | F1-score |
|---|---:|
| Cardboard | 0.91 |
| Glass | 0.78 |
| Metal | 0.79 |
| Paper | 0.88 |
| Plastic | 0.79 |
| Trash | 0.65 |

## 7. Confidence and Manual Review

- Selected provisional threshold: 0.60
- Predictions below the threshold are flagged for manual review.
- Validation automatic coverage: 84.43%
- Validation automatic accuracy: 88.75%
- Validation manual review rate: 15.57%

Model scores are not guaranteed calibrated probabilities. The threshold is an initial operating choice based on validation data.

## 8. Limitations

- Performance may decrease on real-world images with cluttered backgrounds, poor lighting, or unusual camera angles.
- Some categories, particularly trash, are difficult to distinguish.
- The model predicts visual categories, not chemical composition.
- The model does not determine whether an item is universally recyclable.
- Local recycling instructions must come from separately reviewed local guidance.
- Human review is required for uncertain or unsupported cases.

## 9. Intended Use

The model is intended to support household waste image classification and recycling guidance workflows.

It should be used as a decision-support tool, not as a replacement for human judgment or local waste-management regulations.

## 10. Saved Artifacts

- models/wastewise_mobilenetv2_head.keras
- models/model_config.json
- models/evaluation_results.json
- models/threshold_analysis.json

## 11. Future Improvements

- Collect more real-world waste images.
- Improve trash and plastic classification.
- Evaluate performance across different lighting and backgrounds.
- Perform external evaluation on independently collected images.
- Reassess confidence thresholds as reviewed data grows.

## 12. Version History

- Version 1.0.0: Initial MobileNetV2 classification model.
