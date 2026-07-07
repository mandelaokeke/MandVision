# MandVision
Serverless AWS event-driven image and document processing pipeline using S3, Lambda, API Gateway, SQS, Step Functions, Rekognition, Textract, DynamoDB, and CDK.

A production-inspired serverless application that automatically processes images and documents uploaded by users using an event-driven AWS architecture.

Users upload media through a secure web application using pre-signed S3 URLs. Upload events trigger an asynchronous processing pipeline powered by Amazon SQS, AWS Lambda, Step Functions, Amazon Rekognition, and Amazon Textract. Metadata is stored in DynamoDB, and users are notified when processing is complete.

## Architecture

Next.js → API Gateway → Lambda → S3 → EventBridge/SQS → Processing Lambda → Rekognition/Textract → DynamoDB → SNS

## Tech Stack

- TypeScript
- Next.js
- AWS CDK
- Amazon S3
- AWS Lambda
- API Gateway
- Amazon SQS
- AWS Step Functions
- Amazon Rekognition
- Amazon Textract
- Amazon DynamoDB
- Amazon SNS
- GitHub Actions

## Features

- Secure browser uploads using pre-signed S3 URLs
- Event-driven processing pipeline
- Image labeling and moderation with Amazon Rekognition
- Document text extraction with Amazon Textract
- Thumbnail generation
- Metadata persistence in DynamoDB
- Asynchronous notifications
- Infrastructure as Code with AWS CDK
- CI/CD with GitHub Actions
- CloudWatch monitoring and alarms
