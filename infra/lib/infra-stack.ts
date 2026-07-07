import * as cdk from "aws-cdk-lib";

import { Construct } from "constructs";

import * as s3 from "aws-cdk-lib/aws-s3";

import * as lambda from "aws-cdk-lib/aws-lambda";

import * as apigateway from "aws-cdk-lib/aws-apigateway";

import * as iam from "aws-cdk-lib/aws-iam";

export class InfraStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {

    super(scope, id, props);

    const ingestBucket = new s3.Bucket(this, "IngestBucket", {

      removalPolicy: cdk.RemovalPolicy.DESTROY,

      autoDeleteObjects: true,

      cors: [

        {

          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],

          allowedOrigins: ["*"],

          allowedHeaders: ["*"],

        },

      ],

    });

    const presignLambda = new lambda.Function(this, "PresignUrlLambda", {

      runtime: lambda.Runtime.NODEJS_20_X,

      handler: "handler.main",

      code: lambda.Code.fromAsset("../services/presign-url"),

      environment: {

        INGEST_BUCKET_NAME: ingestBucket.bucketName,

      },

    });

    ingestBucket.grantPut(presignLambda);

    presignLambda.addToRolePolicy(

      new iam.PolicyStatement({

        actions: ["s3:PutObject"],

        resources: [`${ingestBucket.bucketArn}/*`],

      })

    );

    const api = new apigateway.RestApi(this, "MediaPipelineApi", {

      restApiName: "event-driven-media-pipeline-api",

      defaultCorsPreflightOptions: {

        allowOrigins: apigateway.Cors.ALL_ORIGINS,

        allowMethods: apigateway.Cors.ALL_METHODS,

      },

    });

    const upload = api.root.addResource("upload-url");

    upload.addMethod("POST", new apigateway.LambdaIntegration(presignLambda));

    new cdk.CfnOutput(this, "ApiUrl", {

      value: api.url,

    });

    new cdk.CfnOutput(this, "IngestBucketName", {

      value: ingestBucket.bucketName,

    });

  }

}