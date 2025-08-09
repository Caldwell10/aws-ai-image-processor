import json
import boto3
from datetime import datetime
from decimal import Decimal
from boto3.dynamodb.conditions import Key, Attr

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')
table = dynamodb.Table('image-analysis-results')

BUCKET_NAME = 'caldwell-ai-image-processor-2025'

def cors_response(status_code, body):
    """Standard CORS response for all API endpoints"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body, default=lambda obj: float(obj) if isinstance(obj, Decimal) else obj)
    }

def lambda_handler(event, context):
    """
    Handle API requests for image analysis results
    GET /api/v1/images - List all images with pagination
    GET /api/v1/images/{id} - Get specific image analysis
    """
    
    # Handle CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return cors_response(200, {'message': 'CORS preflight'})
    
    try:
        http_method = event.get('httpMethod')
        path_parameters = event.get('pathParameters') or {}
        query_parameters = event.get('queryStringParameters') or {}
        
        if http_method == 'GET':
            
            # GET /api/v1/images/{id} - Single image details
            if 'image_id' in path_parameters:
                return get_single_image(path_parameters['image_id'])
            
            # GET /api/v1/images - List images with optional filters
            else:
                return list_images(query_parameters)
        
        else:
            return cors_response(405, {'error': 'Method not allowed'})
            
    except Exception as e:
        print(f"API error: {str(e)}")
        return cors_response(500, {
            'error': 'Internal server error',
            'message': 'Please try again later'
        })

def get_single_image(image_id):
    """Get detailed analysis for a specific image
    Args:
        image_id (str): The unique ID of the image to retrieve.
    Returns:
        dict: Image details and analysis results.
    """
    try:
        response = table.get_item(Key={'image_id': image_id})
        
        if 'Item' not in response:
            return cors_response(404, {
                'error': 'Image not found',
                'image_id': image_id
            })
        
        item = response['Item']
        
        # Generate presigned URL for image viewing
        try:
            presigned_url = s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': BUCKET_NAME, 'Key': item.get('unique_filename', item['filename'])},
                ExpiresIn=3600  # 1 hour
            )
            item['image_url'] = presigned_url
        except Exception as e:
            print(f"Could not generate presigned URL: {e}")
            item['image_url'] = None
        
        return cors_response(200, {
            'image': item,
            'analysis_complete': item.get('processing_status') == 'completed'
        })
        
    except Exception as e:
        print(f"Error getting single image: {e}")
        return cors_response(500, {'error': 'Failed to retrieve image'})

def list_images(query_params):
    """List images with pagination and filtering"""
    try:
        # Pagination parameters
        limit = min(int(query_params.get('limit', 20)), 100)  # Max 100 items
        last_key = query_params.get('last_key')
        
        # Filter parameters
        status_filter = query_params.get('status')  # 'completed', 'processing', 'failed'
        
        # Build scan parameters
        scan_params = {
            'Limit': limit,
            'Select': 'ALL_ATTRIBUTES'
        }
        
        # Add pagination
        if last_key:
            try:
                scan_params['ExclusiveStartKey'] = {'image_id': last_key}
            except Exception:
                pass  # Invalid last_key, ignore
        
        # Add status filter
        if status_filter:
            scan_params['FilterExpression'] = Attr('processing_status').eq(status_filter)
        
        # Scan table
        response = table.scan(**scan_params)
        items = response.get('Items', [])
        
        # Sort by upload time (newest first)
        items.sort(key=lambda x: x.get('upload_time', ''), reverse=True)
        
        # Generate presigned URLs for recent images
        for item in items[:10]:  # Only for first 10 to avoid API limits
            try:
                filename = item.get('unique_filename', item.get('filename'))
                if filename:
                    presigned_url = s3.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': BUCKET_NAME, 'Key': filename},
                        ExpiresIn=3600
                    )
                    item['thumbnail_url'] = presigned_url
            except Exception:
                item['thumbnail_url'] = None
        
        # Prepare response
        result = {
            'images': items,
            'count': len(items),
            'has_more': 'LastEvaluatedKey' in response
        }
        
        # Add pagination info
        if 'LastEvaluatedKey' in response:
            result['next_key'] = response['LastEvaluatedKey']['image_id']
        
        return cors_response(200, result)
        
    except Exception as e:
        print(f"Error listing images: {e}")
        return cors_response(500, {'error': 'Failed to retrieve images'})