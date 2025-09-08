class Salesline{
    constructor(
        salesid,
        itemId,
        lineAmount,
        qtyOrdered,
        custAccount,
        createdDatetime,
        productLabel,
        importerProductCode
    ) {
        this.salesid = salesid,
        this.itemId = itemId,
        this.lineAmount = lineAmount,
        this.qtyOrdered = qtyOrdered,
        this.custAccount = custAccount,
        
        // In Bosch, customers are registered without using '61-' in beginning
        this.boschExtraAccount = custAccount?.replace(`61-`, '')
        this.createdDatetime = createdDatetime,
        this.productLabel = productLabel,
        this.importerProductCode = importerProductCode
    }
}

module.exports = Salesline