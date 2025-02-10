export interface CloudFormationResource {
    readonly Type: string;
    readonly Properties: { [key: string]: unknown };
    readonly Condition?: string;
}

export interface CloudFormationTemplate {
    Resources?: { [id: string]: CloudFormationResource };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Conditions?: { [id: string]: any };
    Outputs?: { [id: string]: CloudFormationOutput };
    Mappings?: { [id: string]: { [key: string]: unknown } };

    Parameters?: { [id: string]: CloudFormationParameter };
}

export interface CloudFormationParameter {
    readonly Type: string;
    readonly Default?: unknown;
    readonly AllowedValues?: unknown[];
    readonly AllowedPattern?: string;
    readonly ConstraintDescription?: string;
    readonly MaxLength?: number;
    readonly MinLength?: number;
    readonly MaxValue?: number;
    readonly MinValue?: number;
    readonly NoEcho?: boolean;
    readonly Description?: string;
}

export interface CloudFormationOutput {
    readonly Description?: string;
    readonly Value: unknown;
}
