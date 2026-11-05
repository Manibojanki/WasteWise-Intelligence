
from pathlib import Path
from collections import defaultdict
import hashlib

DATASET_DIR = Path("dataset")

hash_groups = defaultdict(list)

for category_dir in sorted(DATASET_DIR.iterdir()):
    if not category_dir.is_dir():
        continue

    for image_path in category_dir.glob("*.jpg"):
        with open(image_path, "rb") as file:
            image_hash = hashlib.sha256(file.read()).hexdigest()

        hash_groups[image_hash].append(str(image_path))

duplicates = {
    image_hash: paths
    for image_hash, paths in hash_groups.items()
    if len(paths) > 1
}

print("Total images:", sum(len(paths) for paths in hash_groups.values()))
print("Unique images:", len(hash_groups))
print("Duplicate groups:", len(duplicates))

if duplicates:
    print("\nDuplicate image groups:")
    for paths in duplicates.values():
        print("\n".join(paths))
else:
    print("\nNo exact duplicate images found!")

