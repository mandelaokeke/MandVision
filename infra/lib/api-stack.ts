import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

interface ApiStackProps extends cdk.StackProps {
  ingestBucket: s3.Bucket;
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const presignLambda = new lambdaNodejs.NodejsFunction(this, "PresignUrlLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "../services/presign-url/src/handler.ts",
      handler: "main",
      environment: {
        INGEST_BUCKET_NAME: props.ingestBucket.bucketName,
      },
    });

    props.ingestBucket.grantPut(presignLambda);

    const api = new apigateway.RestApi(this, "MediaPipelineApi", {
      restApiName: "mand-image-processing-api",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const uploadUrl = api.root.addResource("upload-url");
    uploadUrl.addMethod("POST", new apigateway.LambdaIntegration(presignLambda));

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
    });
  }
}