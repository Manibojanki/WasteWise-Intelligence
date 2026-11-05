from backend.predict import predict_waste

files = [
    "sample.jpg",
    "glass_sample.jpg",
    "metal_sample.jpg",
    "paper_sample.jpg",
    "plastic_sample.jpg",
    "trash_sample.jpg"
]

for file in files:
    image_path = "test_images/" + file

    result = predict_waste(image_path)

    print("\nImage:", file)
    print("Prediction:", result["predicted_class"])
    print("Confidence:", result["confidence_percentage"], "%")
    print("Status:", result["status"])