#!/bin/bash

# Test script for POST /ask endpoint
# Usage: ./scripts/curl_test.sh

SERVER_URL="http://localhost:8787"

echo "Testing POST /ask endpoint..."
echo "Server URL: $SERVER_URL"
echo ""

# Sample request payload
curl -X POST "$SERVER_URL/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is machine learning?",
    "page": {
      "url": "https://example.com/ml-guide",
      "title": "Machine Learning Guide",
      "contentType": "html",
      "selectedText": "Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed.",
      "mainText": "Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed. It uses algorithms to analyze data, identify patterns, and make predictions or decisions. There are three main types of machine learning: supervised learning, unsupervised learning, and reinforcement learning. Supervised learning uses labeled data to train models. Unsupervised learning finds patterns in unlabeled data. Reinforcement learning uses rewards and penalties to guide learning. Deep learning is a subset of machine learning that uses neural networks with multiple layers. These networks can learn complex patterns from large amounts of data. Natural language processing is another application of machine learning. It helps computers understand and generate human language. Computer vision uses machine learning to interpret visual information. Recommendation systems use machine learning to suggest products or content. Machine learning has applications in healthcare, finance, transportation, and many other fields."
    }
  }' \
  -s | python3 -m json.tool 2>/dev/null || echo "Note: Install python3 for formatted JSON output, or view raw response above"

echo ""
echo "Test complete!"
