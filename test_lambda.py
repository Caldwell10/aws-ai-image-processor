import boto3
import json
from datetime import datetime
import uuid
from decimal import Decimal

def lambda_handler(event, context):
    """
    This function runs automatically when an image is uploaded to S3
    """
    
    # Set up AWS services
    rekognition = boto3.client('rekognition')
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table('image-analysis-results')
    
    print(" Lambda function started!")
    
    try:
        # Get information about the uploaded image from S3 event
        for record in event['Records']:
            bucket_name = record['s3']['bucket']['name']
            image_name = record['s3']['object']['key']
            
            print(f" Processing: {image_name}")
            
            # Create unique ID for this analysis
            analysis_id = str(uuid.uuid4())
            
            # 1. Analyze images
            print(" Detecting objects...")
            objects_response = rekognition.detect_labels(
                Image={'S3Object': {'Bucket': bucket_name, 'Name': image_name}},
                MaxLabels=10,
                MinConfidence=70
            )
            
            # Extract object names and confidence scores
            objects_found = []
            for label in objects_response['Labels']:
                objects_found.append({
                    'name': label['Name'],
                    'confidence': Decimal(str(round(label['Confidence'], 1)))
                })
            
            print(f" Found {len(objects_found)} objects")
            
            # 2. Check for inappropriate content
            print(" Checking content safety...")
            moderation_response = rekognition.detect_moderation_labels(
                Image={'S3Object': {'Bucket': bucket_name, 'Name': image_name}},
                MinConfidence=60
            )
            
            # Determine if content is safe
            is_safe = len(moderation_response['ModerationLabels']) == 0
            flags = [label['Name'] for label in moderation_response['ModerationLabels']]
            
            print(f" Content safety: {'Safe' if is_safe else 'Flagged'}")
            
            # 3. Save results to database
            print(" Saving results to database...")
            
            # Prepare data to save
            item_to_save = {
                'image_id': analysis_id,
                'filename': image_name,
                'bucket_name': bucket_name,
                'upload_time': datetime.now().isoformat(),
                'processing_status': 'completed',
                'objects_detected': objects_found,
                'content_moderation': {
                    'is_safe': is_safe,
                    'flags': flags
                }
            }
            
            # Save to DynamoDB
            table.put_item(Item=item_to_save)
            
            print(" Results saved successfully!")
            
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Successfully processed {len(event["Records"])} images',
                'analysis_id': analysis_id
            })
        }
        
    except Exception as e:
        print(f" Error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }
    
def test_locally():
    """
    Simulate an S3 event to test the Lambda function locally
    """
    
    # Simulate the event that S3 sends to Lambda
    fake_s3_event = {
        'Records': [{
            's3': {
                'bucket': {'name': 'caldwell-ai-image-processor-2025'},
                'object': {'key': 'car.jpg'} 
            }
        }]
    }
    
    # Test the function
    result = lambda_handler(fake_s3_event, {})
    print("\n Test Result:")
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    print(" Testing Lambda function locally...")
    test_locally()