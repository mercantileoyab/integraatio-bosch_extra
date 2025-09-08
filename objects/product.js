class Product{
    constructor(
        articleNr,
        rule,
        parameter,
        parentProductGroup
    ) {
        this.articleNr = articleNr,
        this.rule = rule,
        this.parameter = parameter,
        this.parentProductGroup = parentProductGroup
    }
}

module.exports = Product