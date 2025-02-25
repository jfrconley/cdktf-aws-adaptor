import { EcsCluster } from "@cdktf/provider-aws/lib/ecs-cluster/index.js";
import { EcsService } from "@cdktf/provider-aws/lib/ecs-service/index.js";
import { EcsTaskDefinition } from "@cdktf/provider-aws/lib/ecs-task-definition/index.js";
import { CfnCluster, CfnService, CfnTaskDefinition } from "aws-cdk-lib/aws-ecs";
import { describe } from "vitest";
import { itShouldMapCfnElementToTerraformResource } from "../helpers.js";

describe("ECS mappings", () => {
    itShouldMapCfnElementToTerraformResource(
        CfnCluster,
        {
            clusterName: "test-cluster",
            tags: [{
                key: "test-tag-key",
                value: "test-tag-value",
            }],
            configuration: {
                executeCommandConfiguration: {
                    logging: "DEFAULT",
                    kmsKeyId: "test-kms-key-id",
                    logConfiguration: {
                        cloudWatchLogGroupName: "test-log-group",
                        cloudWatchEncryptionEnabled: true,
                        s3BucketName: "test-bucket",
                        s3EncryptionEnabled: true,
                        s3KeyPrefix: "test-prefix",
                    },
                },
                managedStorageConfiguration: {
                    fargateEphemeralStorageKmsKeyId: "test-fargate-kms-key-id",
                    kmsKeyId: "test-kms-key-id",
                },
            },
            serviceConnectDefaults: {
                namespace: "test-namespace",
            },
            clusterSettings: [{
                name: "containerInsights",
                value: "enabled",
            }],
            capacityProviders: ["FARGATE", "FARGATE_SPOT"],
            defaultCapacityProviderStrategy: [{
                capacityProvider: "FARGATE",
                weight: 1,
                base: 1,
            }],
        },
        EcsCluster,
        {
            name: "test-cluster",
            tags: {
                "test-tag-key": "test-tag-value",
            },
            configuration: {
                executeCommandConfiguration: {
                    logging: "DEFAULT",
                    kmsKeyId: "test-kms-key-id",
                    logConfiguration: {
                        cloudWatchLogGroupName: "test-log-group",
                        cloudWatchEncryptionEnabled: true,
                        s3BucketName: "test-bucket",
                        s3BucketEncryptionEnabled: true,
                        s3KeyPrefix: "test-prefix",
                    },
                },
                managedStorageConfiguration: {
                    fargateEphemeralStorageKmsKeyId: "test-fargate-kms-key-id",
                    kmsKeyId: "test-kms-key-id",
                },
            },
            serviceConnectDefaults: {
                namespace: "test-namespace",
            },
            setting: [{
                name: "containerInsights",
                value: "enabled",
            }],
        },
    );

    itShouldMapCfnElementToTerraformResource(
        CfnService,
        {
            serviceName: "test-service",
            cluster: "test-cluster",
            taskDefinition: "test-task-definition",
            desiredCount: 2,
            availabilityZoneRebalancing: "ENABLED",
            enableExecuteCommand: true,
            enableEcsManagedTags: true,
            capacityProviderStrategy: [{
                capacityProvider: "test-provider",
                base: 1,
                weight: 100,
            }],
            deploymentConfiguration: {
                deploymentCircuitBreaker: {
                    enable: true,
                    rollback: true,
                },
                alarms: {
                    alarmNames: ["test-alarm"],
                    enable: true,
                    rollback: true,
                },
                maximumPercent: 200,
                minimumHealthyPercent: 50,
            },
            deploymentController: {
                type: "ECS",
            },
            healthCheckGracePeriodSeconds: 60,
            loadBalancers: [{
                containerName: "test-container",
                containerPort: 80,
                loadBalancerName: "test-lb",
                targetGroupArn: "test-target-group",
            }],
            networkConfiguration: {
                awsvpcConfiguration: {
                    subnets: ["subnet-1", "subnet-2"],
                    securityGroups: ["sg-1", "sg-2"],
                    assignPublicIp: "ENABLED",
                },
            },
            placementConstraints: [{
                type: "memberOf",
                expression: "attribute:ecs.instance-type =~ t3.*",
            }],
            schedulingStrategy: "REPLICA",
            serviceRegistries: [{
                registryArn: "test-registry",
                containerName: "test-container",
                containerPort: 80,
                port: 80,
            }],
            launchType: "FARGATE",
            role: "test-role",
            platformVersion: "LATEST",
            serviceConnectConfiguration: {
                enabled: true,
                namespace: "test-namespace",
                logConfiguration: {
                    logDriver: "awslogs",
                    options: {
                        "awslogs-group": "test-group",
                    },
                    secretOptions: [{
                        name: "test-secret",
                        valueFrom: "test-secret-arn",
                    }],
                },
                services: [{
                    portName: "test-port",
                    clientAliases: [{
                        port: 80,
                        dnsName: "test-dns",
                    }],
                    discoveryName: "test-discovery",
                    ingressPortOverride: 8080,
                    timeout: {
                        idleTimeoutSeconds: 60,
                        perRequestTimeoutSeconds: 60,
                    },
                    tls: {
                        issuerCertificateAuthority: {
                            awsPcaAuthorityArn: "test-aws-pca-authority-arn",
                        },
                        kmsKey: "test-kms-key",
                        roleArn: "test-role-arn",
                    },
                }],
            },
            tags: [{
                key: "test-tag-key",
                value: "test-tag-value",
            }],
            placementStrategies: [{
                type: "spread",
                field: "attribute:ecs.availability-zone",
            }],
            volumeConfigurations: [{
                name: "test-volume",
                managedEbsVolume: {
                    volumeInitializationRate: 100,
                    roleArn: "test-role-arn",
                    volumeType: "gp3",
                    iops: 3000,
                    encrypted: true,
                    filesystemType: "ext4",
                    kmsKeyId: "test-kms-key-id",
                    sizeInGiB: 20,
                    throughput: 125,
                    snapshotId: "test-snapshot",
                    tagSpecifications: [{
                        resourceType: "volume",
                        tags: [{
                            key: "test-volume-tag-key",
                            value: "test-volume-tag-value",
                        }],
                        propagateTags: "SERVICE",
                    }],
                },
            }],
            propagateTags: "SERVICE",
            vpcLatticeConfigurations: [{
                portName: "test-port",
                roleArn: "test-role-arn",
                targetGroupArn: "test-target-group-arn",
            }],
        },
        EcsService,
        {
            name: "test-service",
            cluster: "test-cluster",
            taskDefinition: "${data.aws_ecs_task_definition.resource_resource-task-definition_FCE63DB8.arn}",
            desiredCount: 2,
            availabilityZoneRebalancing: "ENABLED",
            enableExecuteCommand: true,
            enableEcsManagedTags: true,
            capacityProviderStrategy: [{
                capacityProvider: "test-provider",
                base: 1,
                weight: 100,
            }],
            deploymentCircuitBreaker: {
                enable: true,
                rollback: true,
            },
            alarms: {
                alarmNames: ["test-alarm"],
                enable: true,
                rollback: true,
            },
            deploymentMaximumPercent: 200,
            deploymentMinimumHealthyPercent: 50,
            deploymentController: {
                type: "ECS",
            },
            healthCheckGracePeriodSeconds: 60,
            loadBalancer: [{
                containerName: "test-container",
                containerPort: 80,
                targetGroupArn: "test-target-group",
                elbName: "test-lb",
            }],
            networkConfiguration: {
                subnets: ["subnet-1", "subnet-2"],
                securityGroups: ["sg-1", "sg-2"],
                assignPublicIp: true,
            },
            placementConstraints: [{
                type: "memberOf",
                expression: "attribute:ecs.instance-type =~ t3.*",
            }],
            schedulingStrategy: "REPLICA",
            serviceRegistries: {
                registryArn: "test-registry",
                containerName: "test-container",
                containerPort: 80,
                port: 80,
            },
            launchType: "FARGATE",
            iamRole: "test-role",
            platformVersion: "LATEST",
            serviceConnectConfiguration: {
                enabled: true,
                namespace: "test-namespace",
                logConfiguration: {
                    logDriver: "awslogs",
                    options: {
                        "awslogs-group": "test-group",
                    },
                    secretOption: [{
                        name: "test-secret",
                        valueFrom: "test-secret-arn",
                    }],
                },
                service: [{
                    tls: {
                        issuerCertAuthority: {
                            awsPcaAuthorityArn: "test-aws-pca-authority-arn",
                        },
                        kmsKey: "test-kms-key",
                        roleArn: "test-role-arn",
                    },
                    portName: "test-port",
                    discoveryName: "test-discovery",
                    clientAlias: {
                        port: 80,
                        dnsName: "test-dns",
                    },
                    ingressPortOverride: 8080,
                    timeout: {
                        idleTimeoutSeconds: 60,
                        perRequestTimeoutSeconds: 60,
                    },
                }],
            },
            tags: {
                "test-tag-key": "test-tag-value",
            },
            orderedPlacementStrategy: [{
                type: "spread",
                field: "attribute:ecs.availability-zone",
            }],
            propagateTags: "SERVICE",
            forceDelete: undefined,
            forceNewDeployment: undefined,
            waitForSteadyState: true,
            timeouts: undefined,
            triggers: undefined,
            volumeConfiguration: {
                name: "test-volume",
                managedEbsVolume: {
                    roleArn: "test-role-arn",
                    volumeType: "gp3",
                    iops: 3000,
                    encrypted: true,
                    fileSystemType: "ext4",
                    kmsKeyId: "test-kms-key-id",
                    sizeInGb: 20,
                    throughput: 125,
                    snapshotId: "test-snapshot",
                    tagSpecifications: [{
                        resourceType: "volume",
                        tags: {
                            "test-volume-tag-key": "test-volume-tag-value",
                        },
                        propagateTags: "SERVICE",
                    }],
                },
            },
            vpcLatticeConfigurations: [{
                portName: "test-port",
                roleArn: "test-role-arn",
                targetGroupArn: "test-target-group-arn",
            }],
        },
        ["volumeConfigurations.*.managedEbsVolume.volumeInitializationRate"],
    );

    itShouldMapCfnElementToTerraformResource(
        CfnTaskDefinition,
        {
            family: "test-task-definition",
            cpu: "256",
            inferenceAccelerators: [{
                deviceName: "test-device-name",
                deviceType: "test-device-type",
            }],
            ipcMode: "host",
            pidMode: "host",
            memory: "512",
            executionRoleArn: "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
            taskRoleArn: "arn:aws:iam::123456789012:role/ecsTaskRole",
            networkMode: "awsvpc",
            requiresCompatibilities: ["FARGATE"],
            containerDefinitions: [{
                name: "web",
                image: "nginx:latest",
                cpu: 256,
                memory: 512,
                memoryReservation: 256,
                restartPolicy: {
                    enabled: true,
                    ignoredExitCodes: [4],
                    restartAttemptPeriod: 0,
                },
                versionConsistency: "DEFAULT",
                essential: true,
                command: [],
                credentialSpecs: [],
                dependsOn: [],
                disableNetworking: false,
                dnsSearchDomains: [],
                dnsServers: [],
                dockerLabels: {},
                dockerSecurityOptions: [],
                entryPoint: [],
                environmentFiles: [],
                extraHosts: [],
                firelensConfiguration: {
                    type: "fluentbit",
                    options: {},
                },
                healthCheck: {
                    command: [],
                    interval: 0,
                    retries: 0,
                    startPeriod: 0,
                    timeout: 0,
                },
                hostname: "",
                interactive: false,
                links: [],
                linuxParameters: {
                    capabilities: {
                        add: [],
                        drop: [],
                    },
                    devices: [],
                    initProcessEnabled: false,
                    maxSwap: 0,
                    sharedMemorySize: 0,
                    swappiness: 0,
                    tmpfs: [],
                },
                portMappings: [{
                    containerPort: 80,
                    protocol: "tcp",
                    hostPort: 80,
                    name: "web",
                    appProtocol: "http",
                    containerPortRange: "",
                }],
                environment: [{
                    name: "ENV",
                    value: "prod",
                }],
                mountPoints: [{
                    sourceVolume: "efs-volume",
                    containerPath: "/usr/share/nginx/html",
                    readOnly: true,
                }],
                logConfiguration: {
                    logDriver: "awslogs",
                    options: {
                        "awslogs-group": "test-log-group",
                        "awslogs-region": "us-east-1",
                        "awslogs-stream-prefix": "web",
                    },
                    secretOptions: [],
                },
                privileged: false,
                pseudoTerminal: false,
                readonlyRootFilesystem: false,
                repositoryCredentials: {
                    credentialsParameter: "",
                },
                resourceRequirements: [],
                secrets: [],
                startTimeout: 0,
                stopTimeout: 0,
                systemControls: [],
                ulimits: [],
                user: "",
                volumesFrom: [],
                workingDirectory: "",
            }],
            volumes: [{
                name: "efs-volume",
                configuredAtLaunch: false,
                host: {
                    sourcePath: "",
                },
                efsVolumeConfiguration: {
                    filesystemId: "fs-12345678",
                    rootDirectory: "/",
                    transitEncryption: "ENABLED",
                    transitEncryptionPort: 2049,
                    authorizationConfig: {
                        accessPointId: "fsap-12345678",
                        iam: "ENABLED",
                    },
                },
                dockerVolumeConfiguration: {
                    autoprovision: false,
                    driver: "",
                    driverOpts: {
                        "type": "nfs",
                        "device": ":/test",
                    },
                    labels: {
                        "environment": "test",
                    },
                    scope: "shared",
                },
                fSxWindowsFileServerVolumeConfiguration: {
                    authorizationConfig: {
                        credentialsParameter: "",
                        domain: "",
                    },
                    rootDirectory: "",
                    fileSystemId: "",
                },
            }, {
                name: "docker-volume",
                configuredAtLaunch: false,
                host: {
                    sourcePath: "",
                },
                efsVolumeConfiguration: {
                    filesystemId: "",
                    rootDirectory: "",
                    transitEncryption: "ENABLED",
                    transitEncryptionPort: 2049,
                    authorizationConfig: {
                        accessPointId: "",
                        iam: "ENABLED",
                    },
                },
                dockerVolumeConfiguration: {
                    scope: "shared",
                    autoprovision: true,
                    driver: "local",
                    driverOpts: {
                        "type": "nfs",
                        "device": ":/test",
                    },
                    labels: {
                        "environment": "test",
                    },
                },
                fSxWindowsFileServerVolumeConfiguration: {
                    authorizationConfig: {
                        credentialsParameter: "",
                        domain: "",
                    },
                    rootDirectory: "",
                    fileSystemId: "",
                },
            }],
            proxyConfiguration: {
                type: "APPMESH",
                containerName: "envoy",
                proxyConfigurationProperties: [{
                    name: "ProxyIngressPort",
                    value: "15000",
                }, {
                    name: "ProxyEgressPort",
                    value: "15001",
                }],
            },
            placementConstraints: [{
                type: "memberOf",
                expression: "attribute:ecs.instance-type =~ t3.*",
            }],
            enableFaultInjection: true,
            ephemeralStorage: {
                sizeInGiB: 50,
            },
            runtimePlatform: {
                cpuArchitecture: "X86_64",
                operatingSystemFamily: "LINUX",
            },
            tags: [{
                key: "Environment",
                value: "Production",
            }],
        },
        EcsTaskDefinition,
        {
            family: "test-task-definition",
            cpu: "256",
            memory: "512",
            executionRoleArn: "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
            taskRoleArn: "arn:aws:iam::123456789012:role/ecsTaskRole",
            networkMode: "awsvpc",
            requiresCompatibilities: ["FARGATE"],
            containerDefinitions:
                "${jsonencode([{\"Cpu\" = 256, \"DisableNetworking\" = false, \"Environment\" = [{\"Name\" = \"ENV\", \"Value\" = \"prod\"}], \"Essential\" = true, \"FirelensConfiguration\" = {\"Type\" = \"fluentbit\"}, \"HealthCheck\" = {\"Interval\" = 0, \"Retries\" = 0, \"StartPeriod\" = 0, \"Timeout\" = 0}, \"Hostname\" = \"\", \"Image\" = \"nginx:latest\", \"Interactive\" = false, \"LinuxParameters\" = {\"Capabilities\" = {}, \"InitProcessEnabled\" = false, \"MaxSwap\" = 0, \"SharedMemorySize\" = 0, \"Swappiness\" = 0}, \"LogConfiguration\" = {\"LogDriver\" = \"awslogs\", \"Options\" = {\"awslogs-group\" = \"test-log-group\", \"awslogs-region\" = \"us-east-1\", \"awslogs-stream-prefix\" = \"web\"}}, \"Memory\" = 512, \"MemoryReservation\" = 256, \"MountPoints\" = [{\"ContainerPath\" = \"/usr/share/nginx/html\", \"ReadOnly\" = true, \"SourceVolume\" = \"efs-volume\"}], \"Name\" = \"web\", \"PortMappings\" = [{\"AppProtocol\" = \"http\", \"ContainerPort\" = 80, \"ContainerPortRange\" = \"\", \"HostPort\" = 80, \"Name\" = \"web\", \"Protocol\" = \"tcp\"}], \"Privileged\" = false, \"PseudoTerminal\" = false, \"ReadonlyRootFilesystem\" = false, \"RepositoryCredentials\" = {\"CredentialsParameter\" = \"\"}, \"RestartPolicy\" = {\"Enabled\" = true, \"IgnoredExitCodes\" = [4], \"RestartAttemptPeriod\" = 0}, \"StartTimeout\" = 0, \"StopTimeout\" = 0, \"User\" = \"\", \"VersionConsistency\" = \"DEFAULT\", \"WorkingDirectory\" = \"\"}])}",
            volume: [{
                dockerVolumeConfiguration: {
                    scope: "shared",
                    autoprovision: false,
                    driver: "",
                    driverOpts: {
                        "type": "nfs",
                        "device": ":/test",
                    },
                    labels: {
                        "environment": "test",
                    },
                },
                fsxWindowsFileServerVolumeConfiguration: {
                    fileSystemId: "",
                    rootDirectory: "",
                    authorizationConfig: {
                        credentialsParameter: "",
                        domain: "",
                    },
                },
                configureAtLaunch: false,
                hostPath: "",
                name: "efs-volume",
                efsVolumeConfiguration: {
                    fileSystemId: "fs-12345678",
                    rootDirectory: "/",
                    transitEncryption: "ENABLED",
                    transitEncryptionPort: 2049,
                    authorizationConfig: {
                        accessPointId: "fsap-12345678",
                        iam: "ENABLED",
                    },
                },
            }, {
                name: "docker-volume",
                configureAtLaunch: false,
                hostPath: "",
                efsVolumeConfiguration: {
                    fileSystemId: "",
                    rootDirectory: "",
                    transitEncryption: "ENABLED",
                    transitEncryptionPort: 2049,
                    authorizationConfig: {
                        accessPointId: "",
                        iam: "ENABLED",
                    },
                },
                dockerVolumeConfiguration: {
                    scope: "shared",
                    autoprovision: true,
                    driver: "local",
                    driverOpts: {
                        "type": "nfs",
                        "device": ":/test",
                    },
                    labels: {
                        "environment": "test",
                    },
                },
                fsxWindowsFileServerVolumeConfiguration: {
                    fileSystemId: "",
                    rootDirectory: "",
                    authorizationConfig: {
                        credentialsParameter: "",
                        domain: "",
                    },
                },
            }],
            proxyConfiguration: {
                type: "APPMESH",
                containerName: "envoy",
                properties: {
                    "ProxyIngressPort": "15000",
                    "ProxyEgressPort": "15001",
                },
            },
            placementConstraints: [{
                type: "memberOf",
                expression: "attribute:ecs.instance-type =~ t3.*",
            }],
            enableFaultInjection: true,
            ephemeralStorage: {
                sizeInGib: 50,
            },
            ipcMode: "host",
            pidMode: "host",
            skipDestroy: undefined,
            trackLatest: undefined,
            inferenceAccelerator: undefined,
            runtimePlatform: {
                cpuArchitecture: "X86_64",
                operatingSystemFamily: "LINUX",
            },
            tags: {
                "Environment": "Production",
            },
        },
    );
});
