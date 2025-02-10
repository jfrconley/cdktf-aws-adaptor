import { Fn, type TerraformElement, TerraformVariable, type TerraformVariableValidationConfig, VariableType } from "cdktf";
import { Mapping } from "../utils.js";
import type { CloudFormationParameter } from "../../lib/core/cfn.js";
import { Construct } from "constructs";
import { DataAwsSsmParameter } from "@cdktf/provider-aws/lib/data-aws-ssm-parameter/index.js";

const parameterMappings: {[type: string]: Mapping<TerraformVariable>} = {}


function parseSSMParamType(type: string): {isSSMParam: boolean, paramType: string} {
    if (type.startsWith("AWS::SSM::Parameter::Value<")){
        return {isSSMParam: true, paramType: type.replace("AWS::SSM::Parameter::Value<", "").replace(">", "")}
    }
    return {isSSMParam: false, paramType: type}
}

export function findParameterMapping(parameterType: string): Mapping<TerraformElement> {
    const { paramType, isSSMParam} = parseSSMParamType(parameterType)

    if (isSSMParam){

        // If the parameter is an SSM parameter, we need to return a DataAwsSsmParameter with an appropriate mapping
        // Terraform doesn't allow refs inside of TerraformVariable, so we need to return a DataAwsSsmParameter instead
        const ssmMapping: Mapping<DataAwsSsmParameter> = {
            resource: (scope, id, props) => {
                return new DataAwsSsmParameter(scope, `${id}-param`, {
                    name: props.Default as string,
                    withDecryption: true,
                })
            },
            attributes: {
                Ref: (resource: DataAwsSsmParameter) => resource.value
            }
        }
        return ssmMapping as unknown as Mapping<TerraformElement>;
    }
    

    if (parameterMappings[paramType]){
        return parameterMappings[paramType] as unknown as Mapping<TerraformElement>
    }

    throw new Error(`No parameter mapping found for ${parameterType}`)
}

function registerParameterMapping(parameterType: string, mapping: (scope: Construct, id: string, props: Omit<CloudFormationParameter, "Type">) => TerraformVariable){
    parameterMappings[parameterType] = {
        resource: (scope, id, props) => {
            const { isSSMParam } = parseSSMParamType(props.Type)
            if (isSSMParam){
                console.log(props)
                const paramData = new DataAwsSsmParameter(scope, `${id}-param`, {
                    name: props.Default as string,
                    withDecryption: true
                })
                props.Default = paramData.value
            }
            const mapped = mapping(scope, id, props)
            basePropertyValidations(mapped.value, props).forEach(validation => mapped.addValidation(validation))
            return mapped
        },
        attributes: {
            Ref: (resource) => resource.value
        }
    }
}

function simpleTypeMapping(from: string, to: string, mapDefault: (value: string) => unknown, validations: TerraformVariableValidationConfig[] = [] ){
    registerParameterMapping(from, (scope, id, props) => {
        const tvar = new TerraformVariable(scope, id, {
            type: to,
            sensitive: props.NoEcho,
            default: props.Default ? mapDefault(props.Default as string) : undefined,
        })

        validations.forEach(validation => tvar.addValidation({
            ...validation,
            condition: validation.condition.replace("value", tvar.value)
        }))
        return tvar
    })
}

function basePropertyValidations(valueRef: string, props: Omit<CloudFormationParameter, "Type">): TerraformVariableValidationConfig[] {
    const validations: TerraformVariableValidationConfig[] = []
    
    if (props.AllowedValues){
        validations.push({
            condition: `${valueRef} in ${JSON.stringify(props.AllowedValues)}`,
            errorMessage: `value must be one of ${JSON.stringify(props.AllowedValues)}`
        })
    }

    if (props.AllowedPattern){
        validations.push({
            condition: `${valueRef} =~ ${props.AllowedPattern}`,
            errorMessage: `value must match ${props.AllowedPattern}`
        })
    }
    
    if (props.MinLength){
        validations.push({
            condition: `length(${valueRef}) >= ${props.MinLength}`,
            errorMessage: `value must be at least ${props.MinLength} characters long`
        })
    }

    if (props.MaxLength){
        validations.push({
            condition: `length(${valueRef}) <= ${props.MaxLength}`,
            errorMessage: `value must be at most ${props.MaxLength} characters long`
        })
    }
    
    if (props.MinValue){
        validations.push({
            condition: `${valueRef} >= ${props.MinValue}`,
            errorMessage: `value must be at least ${props.MinValue}`
        })
    }

    if (props.MaxValue){
        validations.push({
            condition: `${valueRef} <= ${props.MaxValue}`,
            errorMessage: `value must be at most ${props.MaxValue}`
        })
    }

    return validations
}
export function registerParameterMappings(){
    simpleTypeMapping("String", VariableType.STRING, (value) => value)
    simpleTypeMapping("Number", VariableType.NUMBER, (value) => Fn.tonumber(value))
    simpleTypeMapping("List<Number>", VariableType.LIST_NUMBER, (value) => Fn.tolist(value))
    simpleTypeMapping("CommaDelimitedList", VariableType.LIST_STRING, (value) => Fn.tolist(value))

    simpleTypeMapping("AWS::EC2::AvailabilityZone::Name", VariableType.STRING, (value) => value, [{
        condition: `value =~ /^[a-z]{2}-[a-z]+-\\d+[a-z]$/`,
        errorMessage: `value must be a valid availability zone name (e.g., us-east-1a)`
    }])

    simpleTypeMapping("AWS::EC2::Image::Id", VariableType.STRING, (value) => value, [{
        condition: `value =~ /^ami-[a-f0-9]{8,17}$/`,
        errorMessage: `value must be a valid AMI ID (e.g., ami-0123456789abcdef0)`
    }])

    simpleTypeMapping("AWS::EC2::Instance::Id", VariableType.STRING, (value) => value, [{
        condition: `value =~ /^i-[a-f0-9]{8,17}$/`,
        errorMessage: `value must be a valid EC2 instance ID (e.g., i-1234567890abcdef0)`
    }])

    simpleTypeMapping("AWS::EC2::KeyPair::KeyName", VariableType.STRING, (value) => value, [{
        condition: `value =~ /^[a-zA-Z0-9-_]+$/`,
        errorMessage: `value must be a valid EC2 key pair name containing only alphanumeric characters, hyphens, and underscores`
    }])

    simpleTypeMapping("AWS::EC2::SecurityGroup::GroupName", VariableType.STRING, (value) => value, [{
        condition: `value =~ /^[a-zA-Z0-9-_. ]+$/`,
        errorMessage: `value must be a valid security group name`
    }])

    simpleTypeMapping("AWS::EC2::SecurityGroup::Id", VariableType.STRING, (value) => value, [{
        condition: `value =~ /^sg-[a-f0-9]{8,17}$/`,
        errorMessage: `value must be a valid security group ID (e.g., sg-0123456789abcdef0)`
    }])

    simpleTypeMapping("AWS::EC2::Subnet::Id", VariableType.STRING, (value) => value, [{
        condition: `value =~ /^subnet-[a-f0-9]{8,17}$/`,
        errorMessage: `value must be a valid subnet ID (e.g., subnet-0123456789abcdef0)`
    }])

    simpleTypeMapping("AWS::EC2::Volume::Id", VariableType.STRING, (value) => value, [{
        condition: `value =~ /^vol-[a-f0-9]{8,17}$/`,
        errorMessage: `value must be a valid EBS volume ID (e.g., vol-0123456789abcdef0)`
    }])

    simpleTypeMapping("AWS::EC2::VPC::Id", VariableType.STRING, (value) => value, [{
        condition: `value =~ /^vpc-[a-f0-9]{8,17}$/`,
        errorMessage: `value must be a valid VPC ID (e.g., vpc-0123456789abcdef0)`
    }])

    simpleTypeMapping("AWS::Route53::HostedZone::Id", VariableType.STRING, (value) => value, [{
        condition: `value =~ /^Z[A-Z0-9]+$/`,
        errorMessage: `value must be a valid Route 53 hosted zone ID (e.g., Z23ABC4XYZL05B)`
    }])

    simpleTypeMapping("List<AWS::EC2::AvailabilityZone::Name>", VariableType.LIST_STRING, (value) => value, [{
        condition: `alltrue([for v in value : v =~ /^[a-z]{2}-[a-z]+-\\d+[a-z]$/])`,
        errorMessage: `all values must be valid availability zone names (e.g., us-east-1a)`
    }])

    simpleTypeMapping("List<AWS::EC2::Image::Id>", VariableType.LIST_STRING, (value) => value, [{
        condition: `alltrue([for v in value : v =~ /^ami-[a-f0-9]{8,17}$/])`,
        errorMessage: `all values must be valid AMI IDs (e.g., ami-0123456789abcdef0)`
    }])

    simpleTypeMapping("List<AWS::EC2::Instance::Id>", VariableType.LIST_STRING, (value) => value, [{
        condition: `alltrue([for v in value : v =~ /^i-[a-f0-9]{8,17}$/])`,
        errorMessage: `all values must be valid EC2 instance IDs (e.g., i-1234567890abcdef0)`
    }])

    simpleTypeMapping("List<AWS::EC2::SecurityGroup::GroupName>", VariableType.LIST_STRING, (value) => value, [{
        condition: `alltrue([for v in value : v =~ /^[a-zA-Z0-9-_. ]+$/])`,
        errorMessage: `all values must be valid security group names`
    }])

    simpleTypeMapping("List<AWS::EC2::SecurityGroup::Id>", VariableType.LIST_STRING, (value) => value, [{
        condition: `alltrue([for v in value : v =~ /^sg-[a-f0-9]{8,17}$/])`,
        errorMessage: `all values must be valid security group IDs (e.g., sg-0123456789abcdef0)`
    }])

    simpleTypeMapping("List<AWS::EC2::Subnet::Id>", VariableType.LIST_STRING, (value) => value, [{
        condition: `alltrue([for v in value : v =~ /^subnet-[a-f0-9]{8,17}$/])`,
        errorMessage: `all values must be valid subnet IDs (e.g., subnet-0123456789abcdef0)`
    }])

    simpleTypeMapping("List<AWS::EC2::Volume::Id>", VariableType.LIST_STRING, (value) => value, [{
        condition: `alltrue([for v in value : v =~ /^vol-[a-f0-9]{8,17}$/])`,
        errorMessage: `all values must be valid EBS volume IDs (e.g., vol-0123456789abcdef0)`
    }])

    simpleTypeMapping("List<AWS::EC2::VPC::Id>", VariableType.LIST_STRING, (value) => value, [{
        condition: `alltrue([for v in value : v =~ /^vpc-[a-f0-9]{8,17}$/])`,
        errorMessage: `all values must be valid VPC IDs (e.g., vpc-0123456789abcdef0)`
    }])

    simpleTypeMapping("List<AWS::Route53::HostedZone::Id>", VariableType.LIST_STRING, (value) => value, [{
        condition: `alltrue([for v in value : v =~ /^Z[A-Z0-9]+$/])`,
        errorMessage: `all values must be valid Route 53 hosted zone IDs (e.g., Z23ABC4XYZL05B)`
    }])
}