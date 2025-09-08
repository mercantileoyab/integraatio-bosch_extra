class Turnover{
    constructor(
        customer,
        wholesaler,
        period,
        turnover,
        productGroup,
        transactionId
    ) {
        this.customer = customer
        this.wholesaler = wholesaler
        this.period = period
        this.operator = turnover < 0 ? '-' : '+'
        this.turnover = turnover < 0 ? -1 * turnover : turnover
        this.productGroup = productGroup
        this.transactionId = transactionId
    }
}

module.exports = Turnover