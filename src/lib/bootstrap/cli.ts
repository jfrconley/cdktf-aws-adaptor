#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
    BootstrapNotFoundError,
    BootstrapStackError,
    createOrUpdateBootstrapStack,
    deleteBootstrapStack,
    getBootstrapValues,
} from "./bootstrap.js";

async function main() {
    await yargs(hideBin(process.argv))
        .command("deploy", "Deploy or update the bootstrap stack", {}, async () => {
            console.log("Deploying bootstrap stack...");
            const values = await createOrUpdateBootstrapStack();
            console.log("Bootstrap stack deployed successfully!");
            console.log("State bucket:", values.stateBucketName);
            console.log("State table:", values.stateTableName);
        })
        .command("status", "Get the current bootstrap stack status", {}, async () => {
            try {
                const values = getBootstrapValues();
                console.log("Bootstrap stack is deployed and ready:");
                console.log("State bucket:", values.stateBucketName);
                console.log("State table:", values.stateTableName);
            } catch (err) {
                if (err instanceof BootstrapNotFoundError) {
                    console.error("\x1b[33m%s\x1b[0m", err.message); // Yellow text for warning
                    process.exit(1);
                }
                if (err instanceof BootstrapStackError) {
                    console.error("\x1b[31m%s\x1b[0m", err.message); // Red text for error
                    process.exit(1);
                }
                throw err;
            }
        })
        .command("cleanup", "Delete the bootstrap stack and all its resources", {
            force: {
                alias: "f",
                type: "boolean",
                description: "Force deletion without confirmation",
                demandOption: true,
            },
        }, async (argv) => {
            if (!argv.force) {
                console.error("\x1b[31m%s\x1b[0m", "Error: --force flag is required for cleanup");
                process.exit(1);
            }

            try {
                // Show what's being deleted
                const values = getBootstrapValues();
                console.log("\x1b[33m%s\x1b[0m", "WARNING: About to delete the following resources:");
                console.log("- State bucket:", values.stateBucketName);
                console.log("- State table:", values.stateTableName);
                console.log("\nProceeding with deletion...");

                await deleteBootstrapStack();
            } catch (err) {
                if (err instanceof BootstrapNotFoundError) {
                    console.error("\x1b[33m%s\x1b[0m", "Bootstrap stack does not exist, nothing to clean up.");
                    process.exit(0);
                }
                if (err instanceof BootstrapStackError) {
                    // For cleanup, we still want to try to delete a stack in a bad state
                    console.log("\x1b[33m%s\x1b[0m", "Stack is in a bad state, attempting cleanup anyway...");
                    await deleteBootstrapStack();
                }
                throw err;
            }
        })
        .demandCommand(1, "You must specify a command")
        .strict()
        .help()
        .parse();
}

main().catch((err) => {
    if (err instanceof BootstrapNotFoundError) {
        console.error("\x1b[33m%s\x1b[0m", err.message); // Yellow text for warning
    } else if (err instanceof BootstrapStackError) {
        console.error("\x1b[31m%s\x1b[0m", err.message); // Red text for error
    } else {
        console.error("\x1b[31m%s\x1b[0m", `Error: ${err.message}`); // Red text for errors
    }
    process.exit(1);
});
