
from pathlib import Path
from collections import Counter
import shutil
import csv

from sklearn.model_selection import train_test_split

# Project paths
SOURCE_DIR = Path("dataset")
OUTPUT_DIR = Path("dataset_split")

# Reproducibility
RANDOM_SEED = 42

# Collect image paths and their labels
image_paths = []
labels = []

for category_dir in sorted(SOURCE_DIR.iterdir()):
    if not category_dir.is_dir():
        continue

    for image_path in sorted(category_dir.glob("*.jpg")):
        image_paths.append(image_path)
        labels.append(category_dir.name)

print("Total images found:", len(image_paths))
print("Original category distribution:", dict(Counter(labels)))

# First split: 70% training, 30% temporary
train_paths, temp_paths, train_labels, temp_labels = train_test_split(
    image_paths,
    labels,
    test_size=0.30,
    random_state=RANDOM_SEED,
    stratify=labels
)

# Second split: 15% validation, 15% testing
val_paths, test_paths, val_labels, test_labels = train_test_split(
    temp_paths,
    temp_labels,
    test_size=0.50,
    random_state=RANDOM_SEED,
    stratify=temp_labels
)

splits = {
    "train": (train_paths, train_labels),
    "validation": (val_paths, val_labels),
    "test": (test_paths, test_labels)
}

# Create output folders and copy images
manifest = []

for split_name, (paths, split_labels) in splits.items():
    for image_path, label in zip(paths, split_labels):
        destination_dir = OUTPUT_DIR / split_name / label
        destination_dir.mkdir(parents=True, exist_ok=True)

        destination_path = destination_dir / image_path.name
        shutil.copy2(image_path, destination_path)

        manifest.append({
            "filename": image_path.name,
            "category": label,
            "split": split_name,
            "source": str(image_path),
            "destination": str(destination_path)
        })

# Save a record of the split
manifest_path = OUTPUT_DIR / "split_manifest.csv"

with open(manifest_path, "w", newline="", encoding="utf-8") as file:
    writer = csv.DictWriter(
        file,
        fieldnames=["filename", "category", "split", "source", "destination"]
    )
    writer.writeheader()
    writer.writerows(manifest)

# Display results
print("\nDATASET SPLIT RESULTS")

for split_name, (paths, split_labels) in splits.items():
    print(f"\n{split_name.upper()}: {len(paths)} images")
    print(dict(Counter(split_labels)))

print("\nTotal split images:", len(manifest))
print("Split manifest saved to:", manifest_path)
print("Random seed:", RANDOM_SEED)
print("\nDataset splitting completed successfully!")
