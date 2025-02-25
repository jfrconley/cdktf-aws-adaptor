// Bootstrap basic state storage in s3 / dynamodb
// Uses an embeded CloudFormation template to create the necessary resources

import { CloudFormation, CloudFormationClient, CreateStackCommand } from "@aws-sdk/client-cloudformation";
import {
    DeleteStackCommand,
    DescribeStacksCommand,
    UpdateStackCommand,
    waitUntilStackCreateComplete,
    waitUntilStackDeleteComplete,
    waitUntilStackUpdateComplete,
} from "@aws-sdk/client-cloudformation";
import { syncAwsSdkV3Operation } from "./aws-sync.js";

const stackId = "CdktfBootstrapStack";

// Stack states that indicate a failed or unusable state
const BAD_STATES = [
    "CREATE_FAILED",
    "ROLLBACK_IN_PROGRESS",
    "ROLLBACK_FAILED",
    "ROLLBACK_COMPLETE",
    "UPDATE_ROLLBACK_IN_PROGRESS",
    "UPDATE_ROLLBACK_FAILED",
    "UPDATE_ROLLBACK_COMPLETE",
    "DELETE_FAILED",
    "DELETE_IN_PROGRESS",
];

const template = {
    Resources: {
        StateBucket: {
            Type: "AWS::S3::Bucket",
            Properties: {
                // enable versioning
                VersioningConfiguration: {
                    Status: "Enabled",
                },
            },
        },
        StateTable: {
            Type: "AWS::DynamoDB::Table",
            Properties: {
                KeySchema: [{ AttributeName: "LockID", KeyType: "HASH" }],
                AttributeDefinitions: [{ AttributeName: "LockID", AttributeType: "S" }],
            },
        },
    },
    Outputs: {
        StateBucketName: {
            Value: { Ref: "StateBucket" },
        },
        StateTableName: {
            Value: { Ref: "StateTable" },
        },
    },
};

export interface BoostrapValues {
    stateBucketName: string;
    stateTableName: string;
}

export class BootstrapNotFoundError extends Error {
    constructor() {
        super("Bootstrap stack not found. Run 'cdktf-bootstrap deploy' to create it.");
        this.name = "BootstrapNotFoundError";
    }
}

export class BootstrapStackError extends Error {
    constructor(status: string) {
        super(
            `Bootstrap stack is in an invalid state: ${status}. Delete the stack with 'cdktf-bootstrap cleanup --force' and try again.`,
        );
        this.name = "BootstrapStackError";
    }
}

// Check if stack exists and is in a good state
async function checkStackState(client: CloudFormationClient): Promise<"NOT_FOUND" | "GOOD" | string> {
    try {
        const { Stacks } = await client.send(new DescribeStacksCommand({ StackName: stackId }));

        if (!Stacks || Stacks.length === 0) {
            return "NOT_FOUND";
        }

        const status = Stacks[0].StackStatus;
        if (!status) {
            throw new Error("Could not determine stack status");
        }

        if (BAD_STATES.includes(status)) {
            return status;
        }

        return "GOOD";
    } catch (err) {
        if (err instanceof Error && err.message.includes("does not exist")) {
            return "NOT_FOUND";
        }
        throw err;
    }
}

// Deploy the bootstrap stack and wait for it to be deployed
export async function deployBootstrapStack(): Promise<BoostrapValues> {
    const client = new CloudFormationClient({});

    // Check if stack is in a bad state first
    const state = await checkStackState(client);
    if (state !== "NOT_FOUND" && state !== "GOOD") {
        throw new BootstrapStackError(state);
    }

    const command = new CreateStackCommand({
        StackName: stackId,
        TemplateBody: JSON.stringify(template),
        Capabilities: ["CAPABILITY_IAM"],
    });

    await client.send(command);
    await waitUntilStackCreateComplete(
        { client, maxWaitTime: 300 },
        { StackName: stackId },
    );

    return getBootstrapValues();
}

// Update the bootstrap stack
export async function updateBootstrapStack(): Promise<BoostrapValues> {
    const client = new CloudFormationClient({});

    // Check if stack is in a bad state first
    const state = await checkStackState(client);
    if (state === "NOT_FOUND") {
        throw new BootstrapNotFoundError();
    }
    if (state !== "GOOD") {
        throw new BootstrapStackError(state);
    }

    const command = new UpdateStackCommand({
        StackName: stackId,
        TemplateBody: JSON.stringify(template),
        Capabilities: ["CAPABILITY_IAM"],
    });

    try {
        await client.send(command);
        await waitUntilStackUpdateComplete(
            { client, maxWaitTime: 300 },
            { StackName: stackId },
        );
    } catch (err) {
        // If no updates are to be performed, consider it a success
        if (err instanceof Error && err.message.includes("No updates are to be performed")) {
            console.log("Stack is up to date, no changes needed");
        } else {
            throw err;
        }
    }

    return getBootstrapValues();
}

// Create or update the bootstrap stack and return the bootstrap values
export async function createOrUpdateBootstrapStack(): Promise<BoostrapValues> {
    const client = new CloudFormationClient({});

    // Check stack state
    const state = await checkStackState(client);

    if (state === "NOT_FOUND") {
        return deployBootstrapStack();
    } else if (state === "GOOD") {
        return updateBootstrapStack();
    } else {
        throw new BootstrapStackError(state);
    }
}

// Get the bootstrap values from the stack outputs
export function getBootstrapValues(): BoostrapValues {
    try {
        const result = syncAwsSdkV3Operation(
            "@aws-sdk/client-cloudformation",
            CloudFormation,
            {},
            "describeStacks",
            { StackName: stackId },
        );
        const Stacks = result.Stacks;

        if (!Stacks || Stacks.length === 0) {
            throw new BootstrapNotFoundError();
        }

        const outputs = Stacks[0].Outputs;
        if (!outputs) {
            throw new Error(`No outputs found for stack ${stackId}. The stack may be in an invalid state.`);
        }

        const stateBucketName = outputs.find(o => o.OutputKey === "StateBucketName")?.OutputValue;
        const stateTableName = outputs.find(o => o.OutputKey === "StateTableName")?.OutputValue;

        if (!stateBucketName || !stateTableName) {
            throw new Error("Required outputs not found in stack. The stack may be in an invalid state.");
        }

        return {
            stateBucketName,
            stateTableName,
        };
    } catch (err) {
        if (err instanceof Error && err.message.includes("does not exist")) {
            throw new BootstrapNotFoundError();
        }
        throw err;
    }
}

// Delete the bootstrap stack and wait for it to be deleted
export async function deleteBootstrapStack(): Promise<void> {
    const client = new CloudFormationClient({});

    try {
        // Check stack state first
        const state = await checkStackState(client);

        if (state === "NOT_FOUND") {
            throw new BootstrapNotFoundError();
        }

        // If stack is in DELETE_IN_PROGRESS, wait for it to complete
        if (state === "DELETE_IN_PROGRESS") {
            console.log("Stack deletion already in progress, waiting for completion...");
            await waitUntilStackDeleteComplete(
                { client, maxWaitTime: 300 },
                { StackName: stackId },
            );
            console.log("Bootstrap stack deleted successfully");
            return;
        }

        // For DELETE_FAILED, we need to abandon the stack first
        if (state === "DELETE_FAILED") {
            console.log("Previous deletion failed, retrying deletion...");
        } else if (BAD_STATES.includes(state)) {
            console.log(`Stack is in ${state} state, attempting forced deletion...`);
        }

        // Delete the stack
        const command = new DeleteStackCommand({
            StackName: stackId,
        });

        await client.send(command);

        // Wait for deletion to complete
        try {
            await waitUntilStackDeleteComplete(
                { client, maxWaitTime: 300 },
                { StackName: stackId },
            );
            console.log("Bootstrap stack deleted successfully");
        } catch (waitErr) {
            // If waiting fails, check if the stack actually exists
            const finalState = await checkStackState(client);
            if (finalState === "NOT_FOUND") {
                console.log("Bootstrap stack deleted successfully");
                return;
            }
            throw waitErr;
        }
    } catch (err) {
        if (err instanceof Error && err.message.includes("does not exist")) {
            throw new BootstrapNotFoundError();
        }

        // Handle rate limiting or throttling errors
        if (
            err instanceof Error && (
                err.message.includes("Rate exceeded")
                || err.message.includes("ThrottlingException")
            )
        ) {
            console.log("AWS request throttled, retrying deletion...");
            // Wait a bit and try again
            await new Promise(resolve => setTimeout(resolve, 5000));
            return deleteBootstrapStack();
        }

        throw err;
    }
}
