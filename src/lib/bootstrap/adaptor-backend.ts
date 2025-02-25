import { Names } from "aws-cdk-lib";
import { S3Backend } from "cdktf";
import { Construct } from "constructs";
import { getBootstrapValues } from "./bootstrap.js";

export class CdkAdaptorBackend extends S3Backend {
    constructor(scope: Construct) {
        const values = getBootstrapValues();
        super(scope, {
            bucket: values.stateBucketName,
            dynamodbTable: values.stateTableName,
            key: CdkAdaptorBackend.generateKey(scope),
        });
    }

    private static generateKey(scope: Construct): string {
        return Names.uniqueId(scope);
    }
}
