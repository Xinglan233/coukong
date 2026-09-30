declare const validate: ((value: unknown) => boolean) & { errors: null | { instancePath: string; message?: string }[] }
export default validate
