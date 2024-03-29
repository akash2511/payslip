'use strict';

const Boom = require('@hapi/boom');
const report = require('../../../modules/JSReport');

module.exports = async (request, h) => {
  try {
    const {employeeId, month_or_year, lop} = request.query;
    let days;
    if (month_or_year === 'month') {
      days = 22;
    } else if (month_or_year === 'year') {
      days = 22 * 12;
    }
    const employeeDetails = await request.server.methods.get_employee_by_id(employeeId);
    const payDetails = await request.server.methods.get_pay_structure_by_slab(employeeDetails.slab);
    const pay_data = [];
    const deduction_data = [];
    for (const item in payDetails) {
      if (payDetails[item].percentage_or_amount === 'percentage' && payDetails[item].type === 'pay') {
        pay_data.push({
          name: payDetails[item].name,
          value: (employeeDetails.ctc * payDetails[item].value * days) / (12 * (22 - lop) * 100),
        });
      } else if (payDetails[item].percentage_or_amount === 'amount' && payDetails[item].type === 'pay') {
        pay_data({
          name: payDetails[item].name,
          value: payDetails[item].value,
        });
      } else if (
        payDetails[item].percentage_or_amount === 'percentage' &&
        payDetails[item].type === 'deduction' &&
        payDetails[item].pf !== true
      ) {
        deduction_data.push({
          name: payDetails[item].name,
          value: (employeeDetails.ctc * payDetails[item].value * days) / (12 * (22 - lop) * 100),
        });
      } else if (
        payDetails[item].percentage_or_amount === 'amount' &&
        payDetails[item].type === 'deduction' &&
        payDetails[item].pf !== true
      ) {
        deduction_data.push({
          name: payDetails[item].name,
          value: payDetails[item].value,
        });
      }
    }
    const pfStructure = payDetails.filter((x) => x.pf === true);
    const basicStructure = payDetails.filter((x) => x.basic_pay === true);
    deduction_data.push({
      name: pfStructure[0].name,
      value:
        (((employeeDetails.ctc * basicStructure[0].value * days) / (12 * (22 - lop) * 100)) * pfStructure[0].value) /
        100,
    });

    const gross_pay = pay_data.reduce((x, y) => x + y.value, 0);
    const total_deductions = deduction_data.reduce((x, y) => x + y.value, 0);
    const net_pay = gross_pay - total_deductions;
    const paySlip = {
      employee_id: employeeDetails._id,
      name: employeeDetails.name,
      address: employeeDetails.address,
      email: employeeDetails.email,
      department: employeeDetails.department_name,
      date_of_joining: employeeDetails.date_of_joining,
      ctc: employeeDetails.ctc,
      pan_number: employeeDetails.pan_number,
      bank_details: employeeDetails.bank_details,
      pay_data,
      deduction_data,
      gross_pay,
      total_deductions,
      net_pay,
    };

    report.generate_report.add(paySlip);

    return {
      statusCode: 200,
      message: 'Employee payslip generated',
      data: paySlip,
    };
  } catch (e) {
    return Boom.badRequest(e);
  }
};
