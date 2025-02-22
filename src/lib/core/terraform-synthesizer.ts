import { DataAwsEcrAuthorizationToken } from "@cdktf/provider-aws/lib/data-aws-ecr-authorization-token/index.js";
import { EcrRepository } from "@cdktf/provider-aws/lib/ecr-repository/index.js";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket/index.js";
import { S3Object } from "@cdktf/provider-aws/lib/s3-object/index.js";
import { Image } from "@cdktf/provider-docker/lib/image/index.js";
import { DockerProvider } from "@cdktf/provider-docker/lib/provider/index.js";
import { RegistryImage } from "@cdktf/provider-docker/lib/registry-image/index.js";
import {
    DefaultStackSynthesizer,
    type DockerImageAssetLocation,
    type DockerImageAssetSource,
    FileAssetLocation,
    FileAssetSource,
    Stage,
} from "aws-cdk-lib";
import { Names } from "aws-cdk-lib/core";
import { AssetType, TerraformAsset, TerraformStack } from "cdktf";
import { join } from "node:path";

export class TerraformSynthesizer extends DefaultStackSynthesizer {
    private readonly assetCacheMap = new Map<string, FileAssetLocation>();
    private _terraformStack?: TerraformStack;

    public set terraformStack(stack: TerraformStack) {
        this._terraformStack = stack;
    }

    public get terraformStack(): TerraformStack {
        if (!this._terraformStack) {
            throw new Error("Terraform stack not set");
        }
        return this._terraformStack;
    }

    addDockerImageAsset(asset: DockerImageAssetSource): DockerImageAssetLocation {
        const assetOutDir = Stage.of(this.boundStack)?.assetOutdir;
        if (!assetOutDir) {
            throw new Error("Asset output directory not found");
        }
        this.ensureDockerProvider();
        const repository = this.getEcrRepository();

        const tag = `${asset.sourceHash}`;
        const imageName = `${repository.repositoryUrl}:${tag}`;

        const fileAsset = new TerraformAsset(this.terraformStack, `asset-${asset.sourceHash}`, {
            assetHash: asset.sourceHash,
            type: AssetType.DIRECTORY,
            path: join(assetOutDir, asset.directoryName || "."),
        });

        const imageAsset = new Image(this.terraformStack, "DockerImage" + asset.sourceHash, {
            name: imageName,
            forceRemove: true,
            buildAttribute: {
                buildArgs: asset.dockerBuildArgs,
                context: fileAsset.path,
                dockerfile: asset.dockerFile || "Dockerfile",
                target: asset.dockerBuildTarget,
                platform: asset.platform,
            },
        });

        const registryImage = new RegistryImage(this.terraformStack, "DockerRegistryImage" + asset.sourceHash, {
            name: imageAsset.name,
            keepRemotely: true,
        });

        return {
            imageUri: registryImage.name,
            repositoryName: repository.name,
            imageTag: tag,
        };
    }

    addFileAsset(asset: FileAssetSource): FileAssetLocation {
        const assetOutDir = Stage.of(this.boundStack)?.assetOutdir;
        if (asset.executable) {
            throw new Error("Cannot deploy executable file assets");
        }
        if (!assetOutDir || !asset.fileName) {
            throw new Error("Cannot determine output directory for file asset");
        }

        if (this.assetCacheMap.has(asset.sourceHash)) {
            return this.assetCacheMap.get(asset.sourceHash)!;
        }

        const terraformAsset = new TerraformAsset(this.terraformStack, `asset-${asset.sourceHash}`, {
            assetHash: asset.sourceHash,
            type: asset.packaging === "zip" ? AssetType.ARCHIVE : AssetType.FILE,
            path: join(assetOutDir, asset.fileName),
        });

        const object = new S3Object(this.terraformStack, `asset-${asset.fileName}-object`, {
            sourceHash: terraformAsset.assetHash,
            source: terraformAsset.path,
            bucket: this.getAssetBucket().bucket,
            key: terraformAsset.assetHash,
        });

        const location = {
            httpUrl: `https://s3.${this.boundStack.region}.amazonaws.com/${this.getAssetBucket().bucket}/${object.key}`,
            bucketName: this.getAssetBucket().bucket,
            objectKey: object.key,
            kmsKeyArn: undefined,
            s3ObjectUrl: `s3://${this.getAssetBucket().bucket}/${object.key}`,
        };

        this.assetCacheMap.set(asset.sourceHash, location);
        return location;
    }

    synthesize() {
        throw new Error("Cannot sythesize CDK stack from terraform synthesizer");
    }

    public getAssetBucket(): S3Bucket {
        let assetBucket = this.terraformStack.node.tryFindChild("AssetBucket") as S3Bucket;
        if (!assetBucket) {
            assetBucket = new S3Bucket(this.terraformStack, "AssetBucket");
        }
        return assetBucket;
    }

    public getEcrRepository(): EcrRepository {
        let ecrRepository = this.terraformStack.node.tryFindChild("EcrRepository") as EcrRepository;
        if (!ecrRepository) {
            ecrRepository = new EcrRepository(this.terraformStack, "EcrRepository", {
                forceDelete: true,
                name: Names.uniqueResourceName(this.terraformStack, {
                    maxLength: 16,
                }).toLowerCase() + "image-assets",
            });
        }
        return ecrRepository;
    }

    public getEcrRepositoryToken() {
        let token = this.terraformStack.node.tryFindChild("EcrRepositoryToken") as DataAwsEcrAuthorizationToken;
        if (!token) {
            token = new DataAwsEcrAuthorizationToken(this.terraformStack, "EcrRepositoryToken", {
                registryId: this.boundStack.account,
            });
        }
        return token;
    }

    public ensureDockerProvider() {
        let provider = this.terraformStack.node.tryFindChild("DockerProvider") as DockerProvider;
        if (!provider) {
            provider = new DockerProvider(this.terraformStack, "DockerProvider", {
                registryAuth: [{
                    address: `${this.boundStack.account}.dkr.ecr.${this.boundStack.region}.amazonaws.com`,
                    username: this.getEcrRepositoryToken().userName,
                    password: this.getEcrRepositoryToken().password,
                }],
            });
        }
        return provider;
    }
}
