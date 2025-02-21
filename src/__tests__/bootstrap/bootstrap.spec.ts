import {
    CloudFormationClient,
    CreateStackCommand,
    DeleteStackCommand,
    DescribeStacksCommand,
    UpdateStackCommand,
} from "@aws-sdk/client-cloudformation";
import { CloudFormation } from "@aws-sdk/client-cloudformation";
import { mockClient } from "aws-sdk-client-mock";
const cfMock = mockClient(CloudFormationClient);
import "aws-sdk-client-mock-jest/vitest";
import type { syncAwsSdkV3Operation } from "../../lib/bootstrap/aws-sync.js";
import "aws-sdk-client-mock-jest";
import { expect, vitest } from "vitest";
const syncAwsSdkV3OperationMock = vitest.fn<typeof syncAwsSdkV3Operation>();
vitest.mock("../../lib/bootstrap/aws-sync.js", () => {
    return {
        syncAwsSdkV3Operation: syncAwsSdkV3OperationMock,
    };
});
const bootstrap = await import("../../lib/bootstrap/bootstrap.js");

describe("bootstrap", () => {
    beforeEach(() => {
        cfMock.reset();
        syncAwsSdkV3OperationMock.mockClear();
    });

    it("should deploy bootstrap stack", async () => {
        cfMock.on(CreateStackCommand).resolves({
            StackId: "123",
        });

        cfMock.on(DescribeStacksCommand).resolves({
            Stacks: [{
                StackName: "CdktfBootstrapStack",
                StackStatus: "CREATE_COMPLETE",
                CreationTime: new Date(),
            }],
        });

        syncAwsSdkV3OperationMock.mockImplementationOnce(() => {
            return {
                Stacks: [{
                    StackName: "CdktfBootstrapStack",
                    StackStatus: "CREATE_COMPLETE",
                    CreationTime: new Date(),
                    Outputs: [{
                        OutputKey: "StateBucketName",
                        OutputValue: "123",
                    }, {
                        OutputKey: "StateTableName",
                        OutputValue: "123",
                    }],
                }],
            };
        });

        const result = await bootstrap.deployBootstrapStack();
        expect(result).toEqual({
            stateBucketName: "123",
            stateTableName: "123",
        });

        expect(syncAwsSdkV3OperationMock).toHaveBeenCalledWith(
            "@aws-sdk/client-cloudformation",
            CloudFormation,
            {},
            "describeStacks",
            { StackName: "CdktfBootstrapStack" },
        );

        expect(cfMock).toHaveReceivedCommandWith(CreateStackCommand, {
            StackName: "CdktfBootstrapStack",
        });
        expect(cfMock).toHaveReceivedCommandWith(DescribeStacksCommand, {
            StackName: "CdktfBootstrapStack",
        });
    });

    it("should update bootstrap stack", async () => {
        cfMock.on(DescribeStacksCommand).resolves({
            Stacks: [{
                StackName: "CdktfBootstrapStack",
                StackStatus: "UPDATE_COMPLETE",
                CreationTime: new Date(),
            }],
        });

        syncAwsSdkV3OperationMock.mockImplementationOnce(() => {
            return {
                Stacks: [{
                    StackName: "CdktfBootstrapStack",
                    StackStatus: "UPDATE_COMPLETE",
                    CreationTime: new Date(),
                    Outputs: [{
                        OutputKey: "StateBucketName",
                        OutputValue: "updated-bucket",
                    }, {
                        OutputKey: "StateTableName",
                        OutputValue: "updated-table",
                    }],
                }],
            };
        });

        const result = await bootstrap.updateBootstrapStack();
        expect(result).toEqual({
            stateBucketName: "updated-bucket",
            stateTableName: "updated-table",
        });
    });

    it("should handle no-op update gracefully", async () => {
        cfMock.on(DescribeStacksCommand).resolves({
            Stacks: [{
                StackName: "CdktfBootstrapStack",
                StackStatus: "UPDATE_COMPLETE",
                CreationTime: new Date(),
            }],
        });

        // Mock update to throw no updates needed error
        cfMock.on(UpdateStackCommand).rejects(new Error("No updates are to be performed"));

        syncAwsSdkV3OperationMock.mockImplementationOnce(() => {
            return {
                Stacks: [{
                    StackName: "CdktfBootstrapStack",
                    StackStatus: "UPDATE_COMPLETE",
                    CreationTime: new Date(),
                    Outputs: [{
                        OutputKey: "StateBucketName",
                        OutputValue: "existing-bucket",
                    }, {
                        OutputKey: "StateTableName",
                        OutputValue: "existing-table",
                    }],
                }],
            };
        });

        const result = await bootstrap.updateBootstrapStack();
        expect(result).toEqual({
            stateBucketName: "existing-bucket",
            stateTableName: "existing-table",
        });
    });

    it("should create new stack when not found during create/update", async () => {
        // First check returns not found
        cfMock.on(DescribeStacksCommand)
            .resolvesOnce({ Stacks: [] }) // For initial check
            .resolves({ // For subsequent checks
                Stacks: [{
                    StackName: "CdktfBootstrapStack",
                    StackStatus: "CREATE_COMPLETE",
                    CreationTime: new Date(),
                }],
            });

        cfMock.on(CreateStackCommand).resolves({
            StackId: "new-stack-id",
        });

        syncAwsSdkV3OperationMock.mockImplementationOnce(() => {
            return {
                Stacks: [{
                    StackName: "CdktfBootstrapStack",
                    StackStatus: "CREATE_COMPLETE",
                    CreationTime: new Date(),
                    Outputs: [{
                        OutputKey: "StateBucketName",
                        OutputValue: "new-bucket",
                    }, {
                        OutputKey: "StateTableName",
                        OutputValue: "new-table",
                    }],
                }],
            };
        });

        const result = await bootstrap.createOrUpdateBootstrapStack();
        expect(result).toEqual({
            stateBucketName: "new-bucket",
            stateTableName: "new-table",
        });
    });

    it("should update existing stack during create/update", async () => {
        cfMock.on(DescribeStacksCommand).resolves({
            Stacks: [{
                StackName: "CdktfBootstrapStack",
                StackStatus: "UPDATE_COMPLETE",
                CreationTime: new Date(),
            }],
        });

        syncAwsSdkV3OperationMock.mockImplementationOnce(() => {
            return {
                Stacks: [{
                    StackName: "CdktfBootstrapStack",
                    StackStatus: "UPDATE_COMPLETE",
                    CreationTime: new Date(),
                    Outputs: [{
                        OutputKey: "StateBucketName",
                        OutputValue: "existing-bucket",
                    }, {
                        OutputKey: "StateTableName",
                        OutputValue: "existing-table",
                    }],
                }],
            };
        });

        const result = await bootstrap.createOrUpdateBootstrapStack();
        expect(result).toEqual({
            stateBucketName: "existing-bucket",
            stateTableName: "existing-table",
        });
    });

    it("should throw BootstrapNotFoundError when getting values for non-existent stack", () => {
        syncAwsSdkV3OperationMock.mockImplementationOnce(() => {
            throw new Error("Stack with id CdktfBootstrapStack does not exist");
        });

        expect(() => bootstrap.getBootstrapValues()).toThrow(bootstrap.BootstrapNotFoundError);
    });

    it("should throw error when stack outputs are missing", () => {
        syncAwsSdkV3OperationMock.mockImplementationOnce(() => {
            return {
                Stacks: [{
                    StackName: "CdktfBootstrapStack",
                    StackStatus: "CREATE_COMPLETE",
                    CreationTime: new Date(),
                    // Missing outputs
                }],
            };
        });

        expect(() => bootstrap.getBootstrapValues()).toThrow("No outputs found for stack");
    });

    it("should throw error when required outputs are missing", () => {
        syncAwsSdkV3OperationMock.mockImplementationOnce(() => {
            return {
                Stacks: [{
                    StackName: "CdktfBootstrapStack",
                    StackStatus: "CREATE_COMPLETE",
                    CreationTime: new Date(),
                    Outputs: [{
                        // Missing required outputs
                        OutputKey: "SomeOtherOutput",
                        OutputValue: "value",
                    }],
                }],
            };
        });

        expect(() => bootstrap.getBootstrapValues()).toThrow("Required outputs not found in stack");
    });

    it("should delete bootstrap stack", async () => {
        cfMock.on(DescribeStacksCommand)
            .resolvesOnce({ // First check
                Stacks: [{
                    StackName: "CdktfBootstrapStack",
                    StackStatus: "CREATE_COMPLETE",
                    CreationTime: new Date(),
                }],
            })
            .resolves({ // Second check during wait
                Stacks: [{
                    StackName: "CdktfBootstrapStack",
                    StackStatus: "DELETE_COMPLETE",
                    CreationTime: new Date(),
                }],
            });

        await bootstrap.deleteBootstrapStack();
        expect(cfMock).toHaveReceivedCommandWith(DeleteStackCommand, {
            StackName: "CdktfBootstrapStack",
        });
    });

    it("should handle stack already being deleted", async () => {
        cfMock.on(DescribeStacksCommand)
            .resolvesOnce({
                Stacks: [{
                    StackName: "CdktfBootstrapStack",
                    StackStatus: "DELETE_IN_PROGRESS",
                    CreationTime: new Date(),
                }],
            })
            .resolves({
                Stacks: [{
                    StackName: "CdktfBootstrapStack",
                    StackStatus: "DELETE_COMPLETE",
                    CreationTime: new Date(),
                }],
            });

        await bootstrap.deleteBootstrapStack();
        // Should not try to delete again
        expect(cfMock).not.toHaveReceivedCommand(DeleteStackCommand);
    });

    it("should throw BootstrapStackError for bad stack state", async () => {
        cfMock.on(DescribeStacksCommand).resolves({
            Stacks: [{
                StackName: "CdktfBootstrapStack",
                StackStatus: "ROLLBACK_COMPLETE",
                CreationTime: new Date(),
            }],
        });

        await expect(bootstrap.createOrUpdateBootstrapStack()).rejects.toThrow(bootstrap.BootstrapStackError);
    });
});
