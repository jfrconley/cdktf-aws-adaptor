import { Client } from "@smithy/types";
import { createRequire } from "node:module";
import { MessageChannel, receiveMessageOnPort, Worker } from "node:worker_threads";

/* eslint-disable @typescript-eslint/no-explicit-any */

type OverloadedReturnType<T> = T extends
    { (...args: any[]): infer R; (...args: any[]): infer R; (...args: any[]): infer R; (...args: any[]): infer R } ? R
    : T extends { (...args: any[]): infer R; (...args: any[]): infer R; (...args: any[]): infer R } ? R
    : T extends { (...args: any[]): infer R; (...args: any[]): infer R } ? R
    : T extends (...args: any[]) => infer R ? R
    : any;

type FunctionPropertyNames<T> = {
    [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

type AwaitedPromise<T> = T extends Promise<infer R> ? R : never;

// Run an aws-sdk v3 operation synchronously in a worker thread.
// Use atomics to wait for the operation to complete.
export function syncAwsSdkV3Operation<
    ClientClass extends { new(config: any): ClassInstance; prototype: any },
    ClassInstance extends Client<any, any, any>,
    ClientConfig extends ConstructorParameters<ClientClass>[0],
    ClassMethods extends ClientClass["prototype"],
    ClassMethodKey extends FunctionPropertyNames<ClassMethods>,
    InputType extends Parameters<ClassMethods[ClassMethodKey]>[0],
>(
    fullPathToLibrary: string,
    clientClass: ClientClass,
    config: ClientConfig,
    method: ClassMethodKey,
    input: InputType,
): AwaitedPromise<OverloadedReturnType<ClassMethods[ClassMethodKey]>>;
export function syncAwsSdkV3Operation<
    ClientClass extends { new(config: any): ClassInstance; prototype: any },
    ClassInstance extends Client<any, any, any>,
    ClientConfig extends ConstructorParameters<ClientClass>[0],
    ClassMethods extends ClientClass["prototype"],
    ClassMethodKey extends FunctionPropertyNames<ClassMethods>,
    InputType extends Parameters<ClassMethods[ClassMethodKey]>[0],
>(
    fullPathToLibrary: string,
    clientClass: ClientClass,
    config: ClientConfig,
    method: ClassMethodKey,
    input: InputType,
    resultPath: string,
    resultMethod: string,
): any;
export function syncAwsSdkV3Operation<
    ClientClass extends { new(config: any): ClassInstance; prototype: any },
    ClassInstance extends Client<any, any, any>,
    ClientConfig extends ConstructorParameters<ClientClass>[0],
    ClassMethods extends ClientClass["prototype"],
    ClassMethodKey extends FunctionPropertyNames<ClassMethods>,
    InputType extends Parameters<ClassMethods[ClassMethodKey]>[0],
>(
    fullPathToLibrary: string,
    clientClass: ClientClass,
    config: ClientConfig,
    method: ClassMethodKey,
    input: InputType,
    resultPath?: string,
    resultMethod?: string,
): any {
    const _require = createRequire(import.meta.url);

    const sdkWorker = new Worker(
        `
const { parentPort } = require("node:worker_threads");

parentPort.addListener("message", async ({ signal, port, libPath, clientName, methodName, input, resultPath, resultMethod, lodashGetPath }) => {
  try {
    const get = require(lodashGetPath);
    const client = new (require(libPath)[clientName])({});
    let result = await client[methodName](input);
    result = resultPath ? get(result, resultPath) : result;
    result = resultMethod ? await result[resultMethod]() : result;
    port.postMessage({ result: JSON.parse(JSON.stringify(result)) });
  } catch (e) {
    port.postMessage({ error: e });
  } finally {
    port.close();
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0);
  }
});
  `,
        { eval: true, stderr: true, stdout: true },
    );
    const signal = new Int32Array(new SharedArrayBuffer(4));
    const className = clientClass.name;

    signal[0] = 0;
    try {
        const subChannel = new MessageChannel();
        sdkWorker.postMessage({
            signal,
            port: subChannel.port1,
            libPath: fullPathToLibrary,
            clientName: className,
            methodName: method,
            resultPath,
            resultMethod,
            lodashGetPath: _require.resolve("lodash.get"),
            input,
        }, [subChannel.port1]);

        Atomics.wait(signal, 0, 0);
        const result = receiveMessageOnPort(subChannel.port2) as { message: { error: Error; result: unknown } };
        if (!result) {
            throw new Error("No result received from worker");
        }
        if (result?.message?.error) {
            throw result.message.error;
        }
        return result.message.result;
    } finally {
        sdkWorker.unref();
    }
}
