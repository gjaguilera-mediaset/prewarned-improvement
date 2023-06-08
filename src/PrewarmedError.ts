export class PrewarmedError extends Error {
    public label: string

    constructor(label, message) {
        super()
        this.label = label
        this.message = message
    }
}