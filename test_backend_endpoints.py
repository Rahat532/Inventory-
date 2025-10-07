import requests
import json

print("Testing Dashboard KPIs Endpoint...")
print("=" * 50)

try:
    response = requests.get("http://127.0.0.1:8000/api/dashboard/kpis", timeout=5)
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    print(f"\nResponse Body:")
    print(json.dumps(response.json(), indent=2))
    
    if response.status_code == 200:
        print("\n✓ KPIs endpoint is working!")
    else:
        print(f"\n✗ Error: Unexpected status code {response.status_code}")
        
except requests.exceptions.ConnectionError:
    print("\n✗ Error: Cannot connect to backend at http://127.0.0.1:8000")
    print("   Make sure the backend is running!")
except Exception as e:
    print(f"\n✗ Error: {e}")

print("\n" + "=" * 50)
print("Testing Product Delete...")
print("=" * 50)

# First, get a product to delete
try:
    response = requests.get("http://127.0.0.1:8000/api/products?limit=1", timeout=5)
    products = response.json()
    
    if products and len(products) > 0:
        product_id = products[0]['id']
        print(f"Found product ID: {product_id}")
        print(f"Product name: {products[0]['name']}")
        print(f"Product is_active: {products[0]['is_active']}")
        
        # Try to delete
        print(f"\nAttempting to delete product {product_id}...")
        delete_response = requests.delete(f"http://127.0.0.1:8000/api/products/{product_id}", timeout=5)
        print(f"Delete Status Code: {delete_response.status_code}")
        print(f"Delete Response: {delete_response.json()}")
        
        # Verify it was soft deleted
        print(f"\nVerifying soft delete...")
        verify_response = requests.get(f"http://127.0.0.1:8000/api/products/{product_id}", timeout=5)
        if verify_response.status_code == 200:
            updated_product = verify_response.json()
            print(f"Product is_active after delete: {updated_product['is_active']}")
            if not updated_product['is_active']:
                print("✓ Product successfully soft deleted!")
            else:
                print("✗ Product is still active after delete!")
    else:
        print("No products found to test delete")
        
except Exception as e:
    print(f"\n✗ Error during delete test: {e}")
