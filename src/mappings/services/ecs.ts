import { DataAwsEcsTaskDefinition } from "@cdktf/provider-aws/lib/data-aws-ecs-task-definition/index.js";
import { EcsClusterCapacityProviders } from "@cdktf/provider-aws/lib/ecs-cluster-capacity-providers/index.js";
import { EcsCluster } from "@cdktf/provider-aws/lib/ecs-cluster/index.js";
import { EcsService } from "@cdktf/provider-aws/lib/ecs-service/index.js";
import { EcsTaskDefinition } from "@cdktf/provider-aws/lib/ecs-task-definition/index.js";
import { Names } from "aws-cdk-lib";
import { CfnCluster, CfnService, CfnTaskDefinition } from "aws-cdk-lib/aws-ecs";
import { Fn } from "cdktf";
import { ImplicitDependencyAspect } from "../implicit-dependency-aspect.js";
import { deleteUndefinedKeys, registerMappingTyped } from "../utils.js";

export function registerEcsMappings() {
    registerMappingTyped(CfnCluster, EcsCluster, {
        resource: (scope, id, props, proxy) => {
            const cluster = new EcsCluster(
                scope,
                id,
                deleteUndefinedKeys({
                    name: props?.ClusterName as string,
                    tags: Object.fromEntries(props?.Tags?.map(({ Key, Value }) => [Key, Value]) || []),
                    configuration: {
                        executeCommandConfiguration: {
                            logging: props?.Configuration?.ExecuteCommandConfiguration?.Logging as
                                | "DEFAULT"
                                | "OVERRIDE"
                                | "DISABLED",
                            kmsKeyId: props?.Configuration?.ExecuteCommandConfiguration?.KmsKeyId,
                            logConfiguration: {
                                cloudWatchLogGroupName: props?.Configuration?.ExecuteCommandConfiguration
                                    ?.LogConfiguration?.CloudWatchLogGroupName,
                                cloudWatchEncryptionEnabled: props?.Configuration?.ExecuteCommandConfiguration
                                    ?.LogConfiguration?.CloudWatchEncryptionEnabled,
                                s3BucketName: props?.Configuration?.ExecuteCommandConfiguration?.LogConfiguration
                                    ?.S3BucketName,
                                s3BucketEncryptionEnabled: props?.Configuration?.ExecuteCommandConfiguration
                                    ?.LogConfiguration?.S3EncryptionEnabled,
                                s3KeyPrefix: props?.Configuration?.ExecuteCommandConfiguration?.LogConfiguration
                                    ?.S3KeyPrefix,
                            },
                        },
                        managedStorageConfiguration: {
                            fargateEphemeralStorageKmsKeyId: props?.Configuration?.ManagedStorageConfiguration
                                ?.FargateEphemeralStorageKmsKeyId,
                            kmsKeyId: props?.Configuration?.ManagedStorageConfiguration?.KmsKeyId,
                        },
                    },
                    serviceConnectDefaults: {
                        namespace: props?.ServiceConnectDefaults?.Namespace as string,
                    },
                    setting: props?.ClusterSettings?.map(({ Name, Value }) => ({
                        name: Name as string,
                        value: Value as string,
                    })),
                }),
            );

            if (props?.ClusterName == null) {
                cluster.name = Names.uniqueResourceName(cluster, {
                    maxLength: 16,
                });
            }

            proxy.touchPath("CapacityProviders");
            if (props?.CapacityProviders?.length) {
                ImplicitDependencyAspect.of(cluster, [
                    new EcsClusterCapacityProviders(scope, `${id}-capacity-providers`, {
                        clusterName: cluster.name,
                        capacityProviders: props?.CapacityProviders as string[],
                        defaultCapacityProviderStrategy: props?.DefaultCapacityProviderStrategy?.map((
                            { CapacityProvider, Base, Weight },
                        ) => ({
                            capacityProvider: CapacityProvider as string,
                            base: Base as number,
                            weight: Weight as number,
                        })),
                    }),
                ]);
            }

            return cluster;
        },
        attributes: {
            Ref: (cluster: EcsCluster) => cluster.name,
            Arn: (cluster: EcsCluster) => cluster.arn,
        },
    });

    registerMappingTyped(CfnService, EcsService, {
        resource: (scope, id, props, proxy) => {
            if (props?.VolumeConfigurations?.length && props?.VolumeConfigurations?.length > 1) {
                throw new Error("VolumeConfigurations must be a single object");
            }

            // ECS removes the revision from the task definition arn on the service if it is the latest
            // The arn we provide includes the revision, so a change is always detected
            // To work around this, we check if the task arn we were given is the latest revision
            // if it is, we use the family name instead

            const requestedTaskDefinition = new DataAwsEcsTaskDefinition(scope, `${id}-task-definition`, {
                taskDefinition: props?.TaskDefinition as string,
            });

            // const latestRevision = new DataAwsEcsTaskDefinition(scope, `${id}-latest-revision`, {
            //     taskDefinition: requestedTaskDefinition.family,
            // });

            return new EcsService(
                scope,
                id,
                deleteUndefinedKeys({
                    name: props?.ServiceName as string,
                    cluster: props?.Cluster as string,
                    taskDefinition: requestedTaskDefinition.arn,
                    desiredCount: props?.DesiredCount,
                    waitForSteadyState: true,
                    availabilityZoneRebalancing: props?.AvailabilityZoneRebalancing,
                    enableExecuteCommand: props?.EnableExecuteCommand,
                    enableEcsManagedTags: props?.EnableECSManagedTags,
                    capacityProviderStrategy: props?.CapacityProviderStrategy?.map((
                        { CapacityProvider, Base, Weight },
                    ) => ({
                        capacityProvider: CapacityProvider as string,
                        base: Base as number,
                        weight: Weight as number,
                    })),
                    deploymentCircuitBreaker: {
                        enable: props?.DeploymentConfiguration?.DeploymentCircuitBreaker?.Enable as boolean,
                        rollback: props?.DeploymentConfiguration?.DeploymentCircuitBreaker?.Rollback as boolean,
                    },
                    deploymentController: {
                        type: props?.DeploymentController?.Type as "ECS" | "CODE_DEPLOY",
                    },
                    alarms: props?.DeploymentConfiguration?.Alarms?.Enable === true
                        ? {
                            alarmNames: props?.DeploymentConfiguration?.Alarms?.AlarmNames,
                            enable: props?.DeploymentConfiguration?.Alarms?.Enable as boolean,
                            rollback: props?.DeploymentConfiguration?.Alarms?.Rollback as boolean,
                        }
                        : (proxy.touchPath("DeploymentConfiguration.Alarms"), undefined),
                    deploymentMaximumPercent: props?.DeploymentConfiguration?.MaximumPercent,
                    deploymentMinimumHealthyPercent: props?.DeploymentConfiguration?.MinimumHealthyPercent,
                    healthCheckGracePeriodSeconds: props?.HealthCheckGracePeriodSeconds,
                    loadBalancer: props?.LoadBalancers?.map((
                        { ContainerName, ContainerPort, LoadBalancerName, TargetGroupArn },
                    ) => ({
                        containerName: ContainerName as string,
                        containerPort: ContainerPort as number,
                        loadBalancerName: LoadBalancerName as string,
                        elbName: LoadBalancerName as string,
                        targetGroupArn: TargetGroupArn as string,
                    })),
                    networkConfiguration: {
                        subnets: props?.NetworkConfiguration?.AwsvpcConfiguration?.Subnets as string[],
                        securityGroups: props?.NetworkConfiguration?.AwsvpcConfiguration?.SecurityGroups as string[],
                        assignPublicIp: props?.NetworkConfiguration?.AwsvpcConfiguration?.AssignPublicIp === "ENABLED",
                    },
                    placementConstraints: props?.PlacementConstraints?.map(({ Type, Expression }) => ({
                        type: Type as "memberOf",
                        expression: Expression as string,
                    })),
                    propagateTags: props?.PropagateTags as "SERVICE" | "TASK_DEFINITION",
                    schedulingStrategy: props?.SchedulingStrategy as "REPLICA" | "DAEMON",
                    serviceRegistries: {
                        registryArn: props?.ServiceRegistries?.[0]?.RegistryArn as string,
                        containerName: props?.ServiceRegistries?.[0]?.ContainerName as string,
                        containerPort: props?.ServiceRegistries?.[0]?.ContainerPort as number,
                        port: props?.ServiceRegistries?.[0]?.Port as number,
                    },
                    launchType: props?.LaunchType as "EC2" | "FARGATE" | "EXTERNAL",
                    iamRole: props?.Role as string,
                    platformVersion: props?.PlatformVersion as string,
                    serviceConnectConfiguration: {
                        enabled: props?.ServiceConnectConfiguration?.Enabled as boolean,
                        namespace: props?.ServiceConnectConfiguration?.Namespace as string,
                        service: props?.ServiceConnectConfiguration?.Services?.map((
                            { PortName, DiscoveryName, ClientAliases, Timeout, Tls, IngressPortOverride },
                        ) => ({
                            portName: PortName as string,
                            discoveryName: DiscoveryName as string,
                            clientAlias: {
                                port: ClientAliases?.[0]?.Port as number,
                                dnsName: ClientAliases?.[0]?.DnsName as string,
                            },
                            ingressPortOverride: IngressPortOverride as number,
                            timeout: {
                                idleTimeoutSeconds: Timeout?.IdleTimeoutSeconds as number,
                                perRequestTimeoutSeconds: Timeout?.PerRequestTimeoutSeconds as number,
                            },
                            tls: {
                                kmsKey: Tls?.KmsKey as string,
                                roleArn: Tls?.RoleArn as string,
                                issuerCertAuthority: {
                                    awsPcaAuthorityArn: Tls?.IssuerCertificateAuthority?.AwsPcaAuthorityArn as string,
                                },
                            },
                        })),
                        logConfiguration: {
                            logDriver: props?.ServiceConnectConfiguration?.LogConfiguration?.LogDriver as
                                | "awslogs"
                                | "fluentd"
                                | "gelf"
                                | "journald"
                                | "splunk"
                                | "syslog",
                            options: props?.ServiceConnectConfiguration?.LogConfiguration?.Options as Record<
                                string,
                                string
                            >,
                            secretOption: props?.ServiceConnectConfiguration?.LogConfiguration?.SecretOptions?.map((
                                { Name, ValueFrom },
                            ) => ({
                                name: Name as string,
                                valueFrom: ValueFrom as string,
                            })),
                        },
                    },
                    tags: Object.fromEntries(props?.Tags?.map(({ Key, Value }) => [Key, Value]) || []),
                    orderedPlacementStrategy: props?.PlacementStrategies?.map(({ Type, Field }) => ({
                        type: Type as "binpack" | "spread" | "random",
                        field: Field as string,
                    })),
                    volumeConfiguration: {
                        managedEbsVolume: {
                            roleArn: props?.VolumeConfigurations?.[0]?.ManagedEBSVolume?.RoleArn as string,
                            volumeType: props?.VolumeConfigurations?.[0]?.ManagedEBSVolume?.VolumeType as
                                | "standard"
                                | "io1"
                                | "io2"
                                | "gp2"
                                | "gp3"
                                | "sc1"
                                | "st1",
                            iops: props?.VolumeConfigurations?.[0]?.ManagedEBSVolume?.Iops as number,
                            encrypted: props?.VolumeConfigurations?.[0]?.ManagedEBSVolume?.Encrypted as boolean,
                            fileSystemType: props?.VolumeConfigurations?.[0]?.ManagedEBSVolume?.FilesystemType as
                                | "ext4"
                                | "xfs",
                            kmsKeyId: props?.VolumeConfigurations?.[0]?.ManagedEBSVolume?.KmsKeyId as string,
                            sizeInGb: props?.VolumeConfigurations?.[0]?.ManagedEBSVolume?.SizeInGiB as number,
                            throughput: props?.VolumeConfigurations?.[0]?.ManagedEBSVolume?.Throughput as number,
                            snapshotId: props?.VolumeConfigurations?.[0]?.ManagedEBSVolume?.SnapshotId as string,
                            tagSpecifications: props?.VolumeConfigurations?.[0]?.ManagedEBSVolume?.TagSpecifications
                                ?.map(({ ResourceType, Tags, PropagateTags }) => ({
                                    resourceType: ResourceType as "volume",
                                    propagateTags: PropagateTags as "SERVICE" | "TASK_DEFINITION",
                                    tags: Object.fromEntries(Tags?.map(({ Key, Value }) => [Key, Value]) || []),
                                })),
                        },
                        name: props?.VolumeConfigurations?.[0]?.Name as string,
                    },
                    vpcLatticeConfigurations: props?.VpcLatticeConfigurations?.map((
                        { PortName, RoleArn, TargetGroupArn },
                    ) => ({
                        portName: PortName as string,
                        roleArn: RoleArn as string,
                        targetGroupArn: TargetGroupArn as string,
                    })),
                }),
            );
        },
        unsupportedProps: ["VolumeConfigurations.*.ManagedEBSVolume.VolumeInitializationRate"],
        attributes: {
            Ref: (service: EcsService) => service.name,
            ServiceArn: (service: EcsService) => service.id,
            Name: (service: EcsService) => service.name,
        },
    });

    registerMappingTyped(CfnTaskDefinition, EcsTaskDefinition, {
        resource: (scope, id, props, proxy) => {
            proxy.touchPath("ContainerDefinitions");

            return new EcsTaskDefinition(
                scope,
                id,
                deleteUndefinedKeys({
                    family: props?.Family as string,
                    cpu: props?.Cpu as string,
                    executionRoleArn: props?.ExecutionRoleArn as string,
                    memory: props?.Memory as string,
                    taskRoleArn: props?.TaskRoleArn as string,
                    containerDefinitions: Fn.jsonencode(props?.ContainerDefinitions),
                    tags: Object.fromEntries(props?.Tags?.map(({ Key, Value }) => [Key, Value]) || []),
                    enableFaultInjection: props?.EnableFaultInjection,
                    networkMode: props?.NetworkMode as "awsvpc" | "bridge" | "host" | "none",
                    proxyConfiguration: props?.ProxyConfiguration
                        ? {
                            containerName: props?.ProxyConfiguration?.ContainerName as string,
                            type: props?.ProxyConfiguration?.Type as "APPMESH" | "TASKS",
                            properties: Object.fromEntries(
                                props?.ProxyConfiguration?.ProxyConfigurationProperties?.map((
                                    { Name, Value },
                                ) => [Name, Value]) || [],
                            ),
                        }
                        : undefined,
                    ephemeralStorage: props?.EphemeralStorage
                        ? {
                            sizeInGib: props?.EphemeralStorage?.SizeInGiB as number,
                        }
                        : undefined,
                    inferenceAccelerators: props?.InferenceAccelerators?.map(({ DeviceName, DeviceType }) => ({
                        deviceName: DeviceName as string,
                        deviceType: DeviceType as string,
                    })),
                    runtimePlatform: props?.RuntimePlatform
                        ? {
                            cpuArchitecture: props?.RuntimePlatform?.CpuArchitecture as "X86_64" | "ARM64",
                            operatingSystemFamily: props?.RuntimePlatform?.OperatingSystemFamily as "LINUX" | "WINDOWS",
                        }
                        : undefined,
                    pidMode: props?.PidMode as "host" | "task",
                    ipcMode: props?.IpcMode as "host" | "task" | "none",
                    requiresCompatibilities: props?.RequiresCompatibilities as ("EC2" | "FARGATE")[],
                    placementConstraints: props?.PlacementConstraints?.map(({ Type, Expression }) => ({
                        type: Type as "memberOf",
                        expression: Expression as string,
                    })),

                    volume: props?.Volumes?.map(v => ({
                        name: v.Name as string,
                        hostPath: v.Host?.SourcePath,
                        efsVolumeConfiguration: {
                            rootDirectory: v.EFSVolumeConfiguration?.RootDirectory,
                            transitEncryption: v.EFSVolumeConfiguration?.TransitEncryption,
                            transitEncryptionPort: v.EFSVolumeConfiguration?.TransitEncryptionPort,
                            accessPointId: v.EFSVolumeConfiguration?.AuthorizationConfig?.AccessPointId,
                            fileSystemId: v.EFSVolumeConfiguration?.FilesystemId as string,
                            authorizationConfig: {
                                accessPointId: v.EFSVolumeConfiguration?.AuthorizationConfig?.AccessPointId,
                                iam: v.EFSVolumeConfiguration?.AuthorizationConfig?.IAM,
                            },
                        },
                        dockerVolumeConfiguration: {
                            driver: v.DockerVolumeConfiguration?.Driver,
                            driverOpts: v.DockerVolumeConfiguration?.DriverOpts,
                            labels: v.DockerVolumeConfiguration?.Labels,
                            scope: v.DockerVolumeConfiguration?.Scope,
                            autoprovision: v.DockerVolumeConfiguration?.Autoprovision,
                        },
                        fsxWindowsFileServerVolumeConfiguration: {
                            authorizationConfig: {
                                credentialsParameter: v.FSxWindowsFileServerVolumeConfiguration?.AuthorizationConfig
                                    ?.CredentialsParameter as string,
                                domain: v.FSxWindowsFileServerVolumeConfiguration?.AuthorizationConfig
                                    ?.Domain as string,
                            },
                            fileSystemId: v.FSxWindowsFileServerVolumeConfiguration?.FileSystemId as string,
                            rootDirectory: v.FSxWindowsFileServerVolumeConfiguration?.RootDirectory as string,
                        },
                        configureAtLaunch: v.ConfiguredAtLaunch,
                    })),
                }),
            );
        },
        attributes: {
            Ref: (taskDefinition: EcsTaskDefinition) => taskDefinition.id,
            TaskDefinitionArn: (taskDefinition: EcsTaskDefinition) => taskDefinition.arn,
        },
    });
}
