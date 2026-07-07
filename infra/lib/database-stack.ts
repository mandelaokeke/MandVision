import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export class DatabaseStack extends cdk.Stack {
  public readonly metadataTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.metadataTable = new dynamodb.Table(this, "MetadataTable", {
      tableName: "mandvision-media-metadata",
      partitionKey: {
        name: "fileId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new cdk.CfnOutput(this, "MetadataTableName", {
      value: this.metadataTable.tableName,
    });
  }
}