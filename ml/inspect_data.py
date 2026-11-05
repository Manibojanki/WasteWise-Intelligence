
from pathlib import Path
from PIL import Image

DATASET_DIR = Path("dataset")

total_images = 0
corrupted_images = []

for category_dir in sorted(DATASET_DIR.iterdir()):
    if not category_dir.is_dir():
        continue

    category_count = 0

    for image_path in category_dir.glob("*"):
        if not image_path.is_file():
            continue

        total_images += 1
        category_count += 1

        try:
            with Image.open(image_path) as img:
                img.verify()
        except Exception:
            corrupted_images.append(str(image_path))

    print(f"{category_dir.name}: {category_count} images checked")

print("\nTotal images:", total_images)
print("Corrupted images:", len(corrupted_images))

if corrupted_images:
    print("\nCorrupted image files:")
    for path in corrupted_images:
        print(path)
else:
    print("\nAll images passed the integrity check!")
