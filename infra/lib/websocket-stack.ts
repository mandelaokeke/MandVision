import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";

export class WebSocketStack extends cdk.Stack {
  public readonly connectionsTable: dynamodb.Table;
  public readonly websocketApi: apigwv2.WebSocketApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.connectionsTable = new dynamodb.Table(this, "ConnectionsTable", {
      tableName: "mandvision-websocket-connections",
      partitionKey: {
        name: "connectionId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const connectLambda = new lambdaNodejs.NodejsFunction(this, "WsConnectLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "../services/ws-connect/src/handler.ts",
      handler: "main",
      environment: {
        CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
      },
    });

    const disconnectLambda = new lambdaNodejs.NodejsFunction(this, "WsDisconnectLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "../services/ws-disconnect/src/handler.ts",
      handler: "main",
      environment: {
        CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
      },
    });

    this.connectionsTable.grantReadWriteData(connectLambda);
    this.connectionsTable.grantReadWriteData(disconnectLambda);

    this.websocketApi = new apigwv2.WebSocketApi(this, "MandVisionWebSocketApi", {
      apiName: "mandvision-websocket-api",
      connectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration(
          "ConnectIntegration",
          connectLambda
        ),
      },
      disconnectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration(
          "DisconnectIntegration",
          disconnectLambda
        ),
      },
    });

    const stage = new apigwv2.WebSocketStage(this, "ProdStage", {
      webSocketApi: this.websocketApi,
      stageName: "prod",
      autoDeploy: true,
    });

    new cdk.CfnOutput(this, "WebSocketUrl", {
      value: stage.url,
    });

    new cdk.CfnOutput(this, "ConnectionsTableName", {
      value: this.connectionsTable.tableName,
    });
  }
}