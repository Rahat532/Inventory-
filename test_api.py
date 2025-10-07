#!/usr/bin/env python3
"""
API Test Script for Inventory Management System
Tests all major API endpoints to ensure functionality
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000/api"

def test_endpoint(endpoint, method="GET", data=None):
    """Test a single API endpoint"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method == "GET":
            response = requests.get(url, timeout=5)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=5)
        
        if response.status_code == 200:
            print(f"✅ {method} {endpoint} - SUCCESS")
            return True
        else:
            print(f"❌ {method} {endpoint} - FAILED ({response.status_code})")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ {method} {endpoint} - ERROR: {e}")
        return False

def main():
    print("🧪 Testing Inventory Management System APIs")
    print("=" * 50)
    
    # Test all major endpoints
    tests = [
        # Dashboard APIs
        ("/dashboard/kpis", "GET"),
        ("/dashboard/low-stock-products", "GET"),
        ("/dashboard/recent-sales", "GET"),
        
        # Product APIs
        ("/products", "GET"),
        ("/categories", "GET"),
        
        # Sales APIs
        ("/sales", "GET"),
        ("/sales/today/summary", "GET"),
        
        # Returns APIs
        ("/returns", "GET"),
        
        # Settings APIs
        ("/settings", "GET"),
    ]
    
    passed = 0
    total = len(tests)
    
    for endpoint, method in tests:
        if test_endpoint(endpoint, method):
            passed += 1
        time.sleep(0.1)  # Small delay between requests
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - System is fully functional!")
    else:
        print(f"⚠️  {total - passed} tests failed - Check logs above")
    
    return passed == total

if __name__ == "__main__":
    main()