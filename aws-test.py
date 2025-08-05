import boto3
from datetime import datetime

def test_aws_conection():
    # test AWS connection

    # Initialize S3 client
    s3 = boto3.client('s3')
    bucket_name = 'caldwell-ai-image-processor-2025'  

    try:
        # List objects in the specified S3 bucket
        response = s3.list_objects_v2(Bucket=bucket_name)

        if 'Contents' in response:
            print("Found uploaded images:")
            for obj in response['Contents']:
                print(f"  📷 {obj['Key']} ({obj['Size']} bytes)")
        else:
            print("No images found in the bucket.")

    except Exception as e:
        print(f"An error occurred: {e}")
        return False
    
if __name__ == "__main__":
    test_aws_conection()