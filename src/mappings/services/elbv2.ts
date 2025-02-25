import { Lb, LbConfig } from "@cdktf/provider-aws/lib/lb/index.js";
import { Names } from "aws-cdk-lib";
import { CfnLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import type { Writeable } from "../../lib/core/type-utils.js";
import { deleteUndefinedKeys, registerMappingTyped } from "../utils.js";

export function registerELBv2Mappings() {
    registerMappingTyped(CfnLoadBalancer, Lb, {
        resource(scope, id, props) {
            if (!props) {
                throw new Error("Properties are required for LoadBalancer");
            }
            const mapped: Writeable<LbConfig> = {
                name: props.Name || Names.uniqueResourceName(scope, { maxLength: 32 }),
                internal: props.Scheme === "internal",
                loadBalancerType: props.Type as string,
                securityGroups: props.SecurityGroups as string[],
                subnets: props.Subnets as string[],
                ipAddressType: props.IpAddressType as string,
            };

            // Only add attributes if they are explicitly set
            const dropInvalidHeaderFields = props.LoadBalancerAttributes?.find(
                attr => attr.Key === "routing.http.drop_invalid_header_fields.enabled",
            )?.Value;
            if (dropInvalidHeaderFields !== undefined) {
                (mapped).dropInvalidHeaderFields = dropInvalidHeaderFields === "true";
            }

            const crossZone = props.LoadBalancerAttributes?.find(
                attr => attr.Key === "load_balancing.cross_zone.enabled",
            )?.Value;
            if (crossZone !== undefined) {
                (mapped).enableCrossZoneLoadBalancing = crossZone === "true";
            }

            const deletionProtection = props.LoadBalancerAttributes?.find(
                attr => attr.Key === "deletion_protection.enabled",
            )?.Value;
            if (deletionProtection !== undefined) {
                (mapped).enableDeletionProtection = deletionProtection === "true";
            }

            const http2 = props.LoadBalancerAttributes?.find(
                attr => attr.Key === "routing.http2.enabled",
            )?.Value;
            if (http2 !== undefined) {
                (mapped).enableHttp2 = http2 === "true";
            }

            const wafFailOpen = props.LoadBalancerAttributes?.find(
                attr => attr.Key === "waf.fail_open.enabled",
            )?.Value;
            if (wafFailOpen !== undefined) {
                (mapped).enableWafFailOpen = wafFailOpen === "true";
            }

            const idleTimeout = props.LoadBalancerAttributes?.find(
                attr => attr.Key === "idle_timeout.timeout_seconds",
            )?.Value;
            if (idleTimeout !== undefined) {
                (mapped).idleTimeout = parseInt(idleTimeout);
            }

            const preserveHostHeader = props.LoadBalancerAttributes?.find(
                attr => attr.Key === "routing.http.preserve_host_header.enabled",
            )?.Value;
            if (preserveHostHeader !== undefined) {
                (mapped).preserveHostHeader = preserveHostHeader === "true";
            }

            if (props.Tags) {
                (mapped).tags = Object.fromEntries(props.Tags.map(({ Key, Value }) => [Key, Value]));
            }

            const xffHeaderProcessingMode = props.LoadBalancerAttributes?.find(
                attr => attr.Key === "routing.http.xff_header_processing.mode",
            )?.Value;
            if (xffHeaderProcessingMode !== undefined) {
                (mapped).xffHeaderProcessingMode = xffHeaderProcessingMode;
            }

            return new Lb(scope, id, deleteUndefinedKeys(mapped));
        },
        attributes: {
            LoadBalancerName: (lb: Lb) => lb.name,
            LoadBalancerFullName: (lb: Lb) => lb.name,
            LoadBalancerArn: (lb: Lb) => lb.arn,
            DNSName: (lb: Lb) => lb.dnsName,
            CanonicalHostedZoneId: (lb: Lb) => lb.zoneId,
            SecurityGroups: (lb: Lb) => lb.securityGroups,
            Ref: (lb: Lb) => lb.id,
        },
    });

    // registerMappingTyped(CfnListener, LbListener, {
    //     resource(scope, id, props) {
    //         if (!props) {
    //             throw new Error("Properties are required for Listener");
    //         }

    //         const mapped: LbListenerConfig = {
    //             loadBalancerArn: props.LoadBalancerArn as string,
    //             port: props.Port,
    //             protocol: props.Protocol as string,
    //             alpnPolicy: props.AlpnPolicy?.[0] as string,
    //             certificateArn: props.Certificates?.[0]?.CertificateArn as string,
    //             sslPolicy: props.SslPolicy as string,
    //             defaultAction: props.DefaultActions?.map(action => ({
    //                 type: action.Type as string,
    //                 authenticateCognito: action.AuthenticateCognitoConfig && {
    //                     userPoolArn: action.AuthenticateCognitoConfig.UserPoolArn as string,
    //                     userPoolClientId: action.AuthenticateCognitoConfig.UserPoolClientId as string,
    //                     userPoolDomain: action.AuthenticateCognitoConfig.UserPoolDomain as string,
    //                     authenticationRequestExtraParams: action.AuthenticateCognitoConfig.AuthenticationRequestExtraParams,
    //                     onUnauthenticatedRequest: action.AuthenticateCognitoConfig.OnUnauthenticatedRequest as string,
    //                     scope: action.AuthenticateCognitoConfig.Scope as string,
    //                     sessionCookieName: action.AuthenticateCognitoConfig.SessionCookieName as string,
    //                     sessionTimeout: action.AuthenticateCognitoConfig.SessionTimeout ?
    //                         Number(action.AuthenticateCognitoConfig.SessionTimeout) : undefined,
    //                 },
    //                 authenticateOidc: action.AuthenticateOidcConfig && {
    //                     authorizationEndpoint: action.AuthenticateOidcConfig.AuthorizationEndpoint as string,
    //                     clientId: action.AuthenticateOidcConfig.ClientId as string,
    //                     clientSecret: action.AuthenticateOidcConfig.ClientSecret as string,
    //                     issuer: action.AuthenticateOidcConfig.Issuer as string,
    //                     tokenEndpoint: action.AuthenticateOidcConfig.TokenEndpoint as string,
    //                     userInfoEndpoint: action.AuthenticateOidcConfig.UserInfoEndpoint as string,
    //                     authenticationRequestExtraParams: action.AuthenticateOidcConfig.AuthenticationRequestExtraParams,
    //                     onUnauthenticatedRequest: action.AuthenticateOidcConfig.OnUnauthenticatedRequest as string,
    //                     scope: action.AuthenticateOidcConfig.Scope as string,
    //                     sessionCookieName: action.AuthenticateOidcConfig.SessionCookieName as string,
    //                     sessionTimeout: action.AuthenticateOidcConfig.SessionTimeout ?
    //                         Number(action.AuthenticateOidcConfig.SessionTimeout) : undefined,
    //                 },
    //                 fixedResponse: action.FixedResponseConfig && {
    //                     contentType: action.FixedResponseConfig.ContentType as string,
    //                     messageBody: action.FixedResponseConfig.MessageBody as string,
    //                     statusCode: action.FixedResponseConfig.StatusCode as string,
    //                 },
    //                 forward: action.ForwardConfig && {
    //                     targetGroup: action.ForwardConfig.TargetGroups?.map(tg => ({
    //                         arn: tg.TargetGroupArn as string,
    //                         weight: tg.Weight,
    //                     })),
    //                     stickiness: action.ForwardConfig.TargetGroupStickinessConfig && {
    //                         duration: action.ForwardConfig.TargetGroupStickinessConfig.DurationSeconds,
    //                         enabled: action.ForwardConfig.TargetGroupStickinessConfig.Enabled,
    //                     },
    //                 },
    //                 redirect: action.RedirectConfig && {
    //                     host: action.RedirectConfig.Host as string,
    //                     path: action.RedirectConfig.Path as string,
    //                     port: action.RedirectConfig.Port as string,
    //                     protocol: action.RedirectConfig.Protocol as string,
    //                     query: action.RedirectConfig.Query as string,
    //                     statusCode: action.RedirectConfig.StatusCode as string,
    //                 },
    //                 targetGroupArn: action.TargetGroupArn as string,
    //             })) as LbListenerDefaultAction[],
    //         };

    //         return new LbListener(scope, id, deleteUndefinedKeys(mapped));
    //     },
    //     attributes: {
    //         ListenerArn: (listener: LbListener) => listener.arn,
    //         Ref: (listener: LbListener) => listener.id,
    //     },
    // });

    // registerMappingTyped(CfnListenerRule, LbListenerRule, {
    //     resource(scope, id, props) {
    //         if (!props) {
    //             throw new Error("Properties are required for ListenerRule");
    //         }

    //         const mapped: LbListenerRuleConfig = {
    //             listenerArn: props.ListenerArn as string,
    //             priority: props.Priority,
    //             action: props.Actions?.map(action => ({
    //                 type: action.Type as string,
    //                 authenticateCognito: action.AuthenticateCognitoConfig && {
    //                     userPoolArn: action.AuthenticateCognitoConfig.UserPoolArn as string,
    //                     userPoolClientId: action.AuthenticateCognitoConfig.UserPoolClientId as string,
    //                     userPoolDomain: action.AuthenticateCognitoConfig.UserPoolDomain as string,
    //                     authenticationRequestExtraParams: action.AuthenticateCognitoConfig.AuthenticationRequestExtraParams,
    //                     onUnauthenticatedRequest: action.AuthenticateCognitoConfig.OnUnauthenticatedRequest as string,
    //                     scope: action.AuthenticateCognitoConfig.Scope as string,
    //                     sessionCookieName: action.AuthenticateCognitoConfig.SessionCookieName as string,
    //                     sessionTimeout: action.AuthenticateCognitoConfig.SessionTimeout ?
    //                         Number(action.AuthenticateCognitoConfig.SessionTimeout) : undefined,
    //                 },
    //                 authenticateOidc: action.AuthenticateOidcConfig && {
    //                     authorizationEndpoint: action.AuthenticateOidcConfig.AuthorizationEndpoint as string,
    //                     clientId: action.AuthenticateOidcConfig.ClientId as string,
    //                     clientSecret: action.AuthenticateOidcConfig.ClientSecret as string,
    //                     issuer: action.AuthenticateOidcConfig.Issuer as string,
    //                     tokenEndpoint: action.AuthenticateOidcConfig.TokenEndpoint as string,
    //                     userInfoEndpoint: action.AuthenticateOidcConfig.UserInfoEndpoint as string,
    //                     authenticationRequestExtraParams: action.AuthenticateOidcConfig.AuthenticationRequestExtraParams,
    //                     onUnauthenticatedRequest: action.AuthenticateOidcConfig.OnUnauthenticatedRequest as string,
    //                     scope: action.AuthenticateOidcConfig.Scope as string,
    //                     sessionCookieName: action.AuthenticateOidcConfig.SessionCookieName as string,
    //                     sessionTimeout: action.AuthenticateOidcConfig.SessionTimeout ?
    //                         Number(action.AuthenticateOidcConfig.SessionTimeout) : undefined,
    //                 },
    //                 fixedResponse: action.FixedResponseConfig && {
    //                     contentType: action.FixedResponseConfig.ContentType as string,
    //                     messageBody: action.FixedResponseConfig.MessageBody as string,
    //                     statusCode: action.FixedResponseConfig.StatusCode as string,
    //                 },
    //                 forward: action.ForwardConfig && {
    //                     targetGroup: action.ForwardConfig.TargetGroups?.map(tg => ({
    //                         arn: tg.TargetGroupArn as string,
    //                         weight: tg.Weight,
    //                     })),
    //                     stickiness: action.ForwardConfig.TargetGroupStickinessConfig && {
    //                         duration: action.ForwardConfig.TargetGroupStickinessConfig.DurationSeconds,
    //                         enabled: action.ForwardConfig.TargetGroupStickinessConfig.Enabled,
    //                     },
    //                 },
    //                 redirect: action.RedirectConfig && {
    //                     host: action.RedirectConfig.Host as string,
    //                     path: action.RedirectConfig.Path as string,
    //                     port: action.RedirectConfig.Port as string,
    //                     protocol: action.RedirectConfig.Protocol as string,
    //                     query: action.RedirectConfig.Query as string,
    //                     statusCode: action.RedirectConfig.StatusCode as string,
    //                 },
    //                 targetGroupArn: action.TargetGroupArn as string,
    //             })) as LbListenerRuleAction[],
    //             condition: props.Conditions?.map(condition => ({
    //                 hostHeader: condition.HostHeaderConfig && {
    //                     values: condition.HostHeaderConfig.Values as string[],
    //                 },
    //                 httpHeader: condition.HttpHeaderConfig && {
    //                     httpHeaderName: condition.HttpHeaderConfig.HttpHeaderName as string,
    //                     values: condition.HttpHeaderConfig.Values as string[],
    //                 },
    //                 httpRequestMethod: condition.HttpRequestMethodConfig && {
    //                     values: condition.HttpRequestMethodConfig.Values as string[],
    //                 },
    //                 pathPattern: condition.PathPatternConfig && {
    //                     values: condition.PathPatternConfig.Values as string[],
    //                 },
    //                 queryString: condition.QueryStringConfig?.Values?.map(qs => ({
    //                     key: qs.Key || "",
    //                     value: qs.Value || "",
    //                 })),
    //                 sourceIp: condition.SourceIpConfig && {
    //                     values: condition.SourceIpConfig.Values as string[],
    //                 },
    //             })) as LbListenerRuleCondition[],
    //         };

    //         return new LbListenerRule(scope, id, deleteUndefinedKeys(mapped));
    //     },
    //     attributes: {
    //         RuleArn: (rule: LbListenerRule) => rule.arn,
    //         IsDefault: (rule: LbListenerRule) => {throw new Error("Not implemented")},
    //         Ref: (rule: LbListenerRule) => rule.id,
    //     },
    // });

    // registerMappingTyped(CfnTargetGroup, LbTargetGroup, {
    //     resource(scope, id, props) {
    //         if (!props) {
    //             throw new Error("Properties are required for TargetGroup");
    //         }

    //         const mapped: LbTargetGroupConfig = {
    //             name: props.Name || Names.uniqueResourceName(scope, { maxLength: 32 }),
    //             targetType: props.TargetType as string,
    //             port: props.Port,
    //             protocol: props.Protocol as string,
    //             protocolVersion: props.ProtocolVersion as string,
    //             vpcId: props.VpcId as string,
    //             connectionTermination: props.TargetGroupAttributes?.find(
    //                 attr => attr.Key === "deregistration_delay.connection_termination.enabled"
    //             )?.Value === "true",
    //             deregistrationDelay: props.TargetGroupAttributes?.find(
    //                 attr => attr.Key === "deregistration_delay.timeout_seconds"
    //             )?.Value as string,
    //             healthCheck: {
    //                 enabled: props.HealthCheckEnabled,
    //                 healthyThreshold: props.HealthyThresholdCount,
    //                 interval: props.HealthCheckIntervalSeconds,
    //                 matcher: props.Matcher?.HttpCode,
    //                 path: props.HealthCheckPath,
    //                 port: props.HealthCheckPort,
    //                 protocol: props.HealthCheckProtocol as string,
    //                 timeout: props.HealthCheckTimeoutSeconds,
    //                 unhealthyThreshold: props.UnhealthyThresholdCount,
    //             },
    //             ipAddressType: props.IpAddressType as string,
    //             lambdaMultiValueHeadersEnabled: props.TargetGroupAttributes?.find(
    //                 attr => attr.Key === "lambda.multi_value_headers.enabled"
    //             )?.Value === "true",
    //             loadBalancingAlgorithmType: props.TargetGroupAttributes?.find(
    //                 attr => attr.Key === "load_balancing.algorithm.type"
    //             )?.Value as string,
    //             preserveClientIp: props.TargetGroupAttributes?.find(
    //                 attr => attr.Key === "preserve_client_ip.enabled"
    //             )?.Value === "true" ? "true" : undefined,
    //             proxyProtocolV2: props.TargetGroupAttributes?.find(
    //                 attr => attr.Key === "proxy_protocol_v2.enabled"
    //             )?.Value === "true",
    //             slowStart: parseInt(
    //                 props.TargetGroupAttributes?.find(
    //                     attr => attr.Key === "slow_start.duration_seconds"
    //                 )?.Value || "0"
    //             ),
    //             stickiness: {
    //                 enabled: props.TargetGroupAttributes?.find(
    //                     attr => attr.Key === "stickiness.enabled"
    //                 )?.Value === "true",
    //                 type: props.TargetGroupAttributes?.find(
    //                     attr => attr.Key === "stickiness.type"
    //                 )?.Value as string,
    //                 cookieDuration: parseInt(
    //                     props.TargetGroupAttributes?.find(
    //                         attr => attr.Key === "stickiness.lb_cookie.duration_seconds"
    //                     )?.Value || "86400"
    //                 ),
    //                 cookieName: props.TargetGroupAttributes?.find(
    //                     attr => attr.Key === "stickiness.app_cookie.cookie_name"
    //                 )?.Value as string,
    //             },
    //             tags: Object.fromEntries(props.Tags?.map(({ Key, Value }) => [Key, Value]) || []),
    //         };

    //         return new LbTargetGroup(scope, id, deleteUndefinedKeys(mapped));
    //     },
    //     attributes: {
    //         LoadBalancerARNs: (tg: LbTargetGroup) => tg.loadBalancerArns,
    //         TargetGroupArn: (tg: LbTargetGroup) => tg.arn,
    //         TargetGroupFullName: (tg: LbTargetGroup) => tg.name,
    //         TargetGroupName: (tg: LbTargetGroup) => tg.name,
    //         Ref: (tg: LbTargetGroup) => tg.id,
    //     },
    // });
}
