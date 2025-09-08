class Customer{
    constructor(
        customerId,
        status,
        wholesalerId,
        wholesalerName
    ) {
        this.customerId = `61-${customerId}`,
        this.status = status,
        this.wholesalerId = wholesalerId,
        this.wholesalerName = wholesalerName
    }
}

module.exports = Customer