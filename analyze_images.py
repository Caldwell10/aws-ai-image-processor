import boto3

def analyze_image_with_ai(bucket_name, image_name):
    """Analyze a single image with AWS Rekognition only"""
    
    rekognition = boto3.client('rekognition')
    
    print(f"\n Analyzing: {image_name}")
    print("=" * 50)
    
    try:
        # 1. OBJECT DETECTION
        print("🏷️  OBJECTS DETECTED:")
        objects_response = rekognition.detect_labels(
            Image={'S3Object': {'Bucket': bucket_name, 'Name': image_name}},
            MaxLabels=10,
            MinConfidence=70
        )
        
        for label in objects_response['Labels']:
            print(f"   • {label['Name']}: {label['Confidence']:.1f}%")
        
        # FACE ANALYSIS
        print("\n👤 FACE ANALYSIS:")
        faces_response = rekognition.detect_faces(
            Image={'S3Object': {'Bucket': bucket_name, 'Name': image_name}},
            Attributes=['ALL']
        )
        
        if faces_response['FaceDetails']:
            for i, face in enumerate(faces_response['FaceDetails'], 1):
                print(f"   Face {i}:")
                
                age = face.get('AgeRange', {})
                print(f"     Age: {age.get('Low', '?')}-{age.get('High', '?')} years")
                
                gender = face.get('Gender', {})
                print(f"     Gender: {gender.get('Value', '?')} ({gender.get('Confidence', 0):.1f}%)")
                
                emotions = face.get('Emotions', [])
                if emotions:
                    top_emotion = max(emotions, key=lambda x: x['Confidence'])
                    print(f"     Emotion: {top_emotion['Type']} ({top_emotion['Confidence']:.1f}%)")
        else:
            print("   No faces detected")
        
        # CONTENT MODERATION
        print("\n  CONTENT MODERATION:")
        moderation_response = rekognition.detect_moderation_labels(
            Image={'S3Object': {'Bucket': bucket_name, 'Name': image_name}},
            MinConfidence=60
        )
        
        if moderation_response['ModerationLabels']:
            print("    Content flags:")
            for label in moderation_response['ModerationLabels']:
                print(f"     • {label['Name']}: {label['Confidence']:.1f}%")
        else:
            print("  Content is safe")
            
        print("\n TEXT EXTRACTION: Skipped (requires service activation)")
            
    except Exception as e:
        print(f" Error analyzing {image_name}: {e}")

def main():
    bucket_name = 'caldwell-ai-image-processor-2025'
    images = ['car.jpg', 'person.jpg', 'stop-sign.jpg']
    
    print(" AI IMAGE ANALYSIS STARTING...")
    
    for image in images:
        analyze_image_with_ai(bucket_name, image)
        print("\n" + "="*70)
    
    print("\n Analysis complete!")

if __name__ == "__main__":
    main()