const divId = "visma-pm";
const customerId = "visma-pm-customer";
const startDateId = "visma-pm-startdate";
const endDateId = "visma-pm-enddate";
const statusId = "visma-pm-status";
let customers = [];

function requestCustomersList(pageIndex = 1) {
    const url = `https://eatime.vismaonline.com/api/customer/paged/search?includeInactive=false&name=&pageIndex=${pageIndex}&pageSize=50&searchColumns=%5B%22name%22,%22number%22%5D`;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = customerListReceived;
    xhr.open("GET", url);
    xhr.send();
}

function customerListReceived(request) {
    if (request.target && request.target.readyState === 4 && request.target.status === 200) {
        let response = JSON.parse(request.target.response);
        if (response.statusCode === 200 && response.result && response.result.items) {
            customers = customers.concat(response.result.items);
            if (response.result.pageIndex < response.result.totalPages) {
                requestCustomersList(response.result.pageIndex + 1);
            } else {
                renderCustomers();
                renderDates();
                renderButton();
            }
        }
    }
}

function renderCustomers() {
    let element = document.createElement("select");
    element.id = customerId;
    element.className = "input-sm";
    for (let i = 0; i < customers.length; ++i) {
        let option = document.createElement("option");
        option.value = customers[i].companyId;
        option.appendChild(document.createTextNode(customers[i].name));
        element.appendChild(option);
    }
    document.getElementById(divId).appendChild(element);
}

function renderDates() {
    // First day of month
    let today = new Date();
    let startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    // Last day of current month
    let endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

    let element = document.createElement("input");
    element.id = startDateId;
    element.type = "text";
    element.className = "input-sm";
    element.value = startDate.toLocaleDateString("sv-SE");
    document.getElementById(divId).appendChild(element);

    element = document.createElement("input");
    element.id = endDateId;
    element.type = "text";
    element.className = "input-sm";
    element.value = endDate.toLocaleDateString("sv-SE");
    document.getElementById(divId).appendChild(element);
}

function renderButton() {
    let element = document.createElement("button");
    element.type = "button";
    element.className = "btn-link";
    element.appendChild(document.createTextNode("Exportera"));
    element.onclick = buttonClicked;
    document.getElementById(divId).appendChild(element);
}

function renderStatus(status) {
    removeStatus();

    let element = document.createElement("span");
    element.id = statusId;
    element.className = "input-sm";
    element.appendChild(document.createTextNode(status));
    document.getElementById(divId).appendChild(element);
}

function removeStatus() {
    let element = document.getElementById(statusId);
    if (element) {
        element.remove();
    }
}

function buttonClicked() {
    removeStatus();

    let customer = customers[document.getElementById(customerId).selectedIndex];
    let startDate = document.getElementById(startDateId).value;
    let endDate = document.getElementById(endDateId).value;
    requestProjectReport(customer.id, startDate, endDate);
}

function requestProjectReport(customerId, startDate, endDate) {
    let url = `https://eatime.vismaonline.com/api/detailedreport/?customerId=${customerId}&startDate=${startDate}&endDate=${endDate}&pageIndex=1&pageSize=1000&includeExpense=true&showTransferred=true&sortExpression.name=entrydate&sortExpression.sortDirection=0`;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = projectReportReceived;
    xhr.open("GET", url);
    xhr.send();
}

function projectReportReceived(request) {
    if (request.target && request.target.readyState === 4 && request.target.status === 200) {
        let response = JSON.parse(request.target.response);
        if (response.statusCode === 200 && response.result && response.result.entries) {
            let items = response.result.entries;

            let result = formatItems(items);

            copyToClipboard(result);
            renderStatus("Kopierat!");
        }
    }
}

function formatItems(items) {
    let projects = [...new Set(items.map(item => item.projectName))];

    let result = projects.map(project => {
        let projectTime = items
            .filter(item => item.projectName === project)
            .reduce((prev, current) => (prev += current.invoiceHours), 0);

        let employees = [...new Set(items.filter(item => item.projectName === project).map(item => item.employeeName))];

        let employeeResult = employees.map(employee => {
            let employeeTime = items
                .filter(item => item.projectName === project)
                .filter(item => item.employeeName === employee)
                .reduce((prev, current) => (prev += current.invoiceHours), 0);

            let articles = [
                ...new Set(
                    items
                        .filter(item => item.projectName === project)
                        .filter(item => item.employeeName === employee)
                        .map(item => item.articleName)
                )
            ];

            let employeeArticles = articles.map(article => {
                let articlesTime = items
                    .filter(item => item.projectName === project)
                    .filter(item => item.employeeName === employee)
                    .filter(item => item.articleName === article)
                    .reduce((prev, current) => (prev += current.invoiceHours), 0);

                let comments = items
                    .filter(item => item.projectName === project)
                    .filter(item => item.employeeName === employee)
                    .filter(item => item.articleName === article)
                    .filter(item => item.invoiceText && !item.invoiceText.match(/^\s+$/))
                    .reduce((prev, current) => (prev += `\t\t\t\t${current.invoiceText}\n`), "");

                return `\t\t${article}\t${articlesTime.toLocaleString("sv-SE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}\n${comments}`;
            });

            return `\t${employee}\t\t${employeeTime.toLocaleString("sv-SE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}\n${employeeArticles.reduce((prev, current) => (prev += `${current}`), "")}`;
        });

        return employeeResult.reduce(
            (prev, current) => (prev += `${current}\n`),
            `${project}\t\t\t${projectTime.toLocaleString("sv-SE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}\n`
        );
    });

    return result.reduce((prev, current) => (prev += `${current}`), "");
}

function copyToClipboard(content) {
    let element = document.createElement("textarea");
    element.style.position = "fixed";
    element.style.opacity = 0;
    element.value = content;
    document.body.appendChild(element);
    element.select();
    document.execCommand("copy");
    document.body.removeChild(element);
}

function addOwnSection() {
    let sections = document.body.getElementsByTagName("section");
    if (sections.length > 0) {
        let node = document.createElement("div");
        node.id = divId;
        node.className = "col-md-12 margin-top";
        sections[0].children[0].remove();
        sections[0].appendChild(node);
        return true;
    }
    return false;
}

function isRapporterPage() {
    let sections = document.body.getElementsByTagName("section");

    return (
        sections.length > 0 &&
        sections[0].children.length > 0 &&
        sections[0].children[0].tagName === "H1" &&
        sections[0].children[0].innerText === "Rapporter"
    );
}

function windowLoaded() {
    if (!isRapporterPage()) return;

    while (!addOwnSection()) {}

    requestCustomersList();
}

window.addEventListener("load", windowLoaded, false);
