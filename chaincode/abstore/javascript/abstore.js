const shim = require('fabric-shim');

const ABstore = class {

  // Initialize the chaincode
  async Init(stub) {
    console.info('========= ABstore Init =========');

    // Define the Admin account details
    let adminAccount = {
      id: "Admin",
      pw: "Adminpw",
      point: 100000000,
      phone_number: "010-1234-5678",
      account_number: "352-1421-0731-73", // 계좌번호는 문자열로 정의
      account_money: 100000000 // 잔액은 정수로 정의
    };

    let ret = stub.getFunctionAndParameters();
    console.info(ret);
    try {
      // JSON 객체를 문자열로 변환하여 상태 데이터로 저장
      await stub.putState(adminAccount.id, Buffer.from(JSON.stringify(adminAccount)));
      return shim.success();
    } catch (err) {
      return shim.error(err);
    }
  }

  async Invoke(stub) {
    let ret = stub.getFunctionAndParameters();
    console.info(ret);
    let method = this[ret.fcn];
    if (!method) {
      console.log('no method of name:' + ret.fcn + ' found');
      return shim.success();
    }
    try {
      let payload = await method(stub, ret.params);
      return shim.success(payload);
    } catch (err) {
      console.log(err);
      return shim.error(err);
    }
  }

  async register(stub, args) {
    console.log('Start registering user...');

    if (args.length != 6) {
        return shim.error('Incorrect number of arguments. Expecting 6');
    }

    let register = {
        type: "user",
        name: args[0].trim(),
        id: args[1].trim(),
        pw: args[2].trim(),
        phone_number: args[3].trim(),
        account_number: args[4].trim(),
        account_money: parseInt(args[5].trim()),
        point: 1000 // 초기 point 값을 1000으로 설정
    };

    console.info(`Attempting to register user: ${JSON.stringify(register)}`);

    // Validate account_money
    if (isNaN(register.account_money) || register.account_money < 0) {
        throw new Error('Expecting non-negative integer value for account_money');
    }

    console.log('Fetching Admin account...');
    let adminBytes = await stub.getState("Admin");
    if (!adminBytes || adminBytes.length === 0) {
        throw new Error('Admin account not found');
    }

    let admin = JSON.parse(adminBytes.toString());
    console.log(`Admin account fetched: ${JSON.stringify(admin)}`);

    if (admin.point < register.point) {
        throw new Error('Insufficient points in admin account');
    }

    // Deduct points from admin and assign to user
    admin.point -= register.point;
    console.log(`Admin after point deduction: ${JSON.stringify(admin)}`);

    await stub.putState(register.id, Buffer.from(JSON.stringify(register)));
    console.log(`User ${register.id} state stored`);

    await stub.putState("Admin", Buffer.from(JSON.stringify(admin)));
    console.log('Admin state updated');

    console.info(`Registered user ${register.name} with ID ${register.id}`);
    console.log(register.id, register.pw);
}

  async login(stub, args) {
    if (args.length != 2) {
      throw new Error('Incorrect number of arguments. Expecting 2');
    }

    let userId = args[0].trim();
    let userPw = args[1].trim();

    let userBytes = await stub.getState(userId);
    if (!userBytes || userBytes.length === 0) {
      throw new Error('User not found');
    }

    let user = JSON.parse(userBytes.toString());

    if (user.pw !== userPw) {
      throw new Error('Incorrect password');
    }

    console.info(`User ${userId} logged in successfully`);
    return Buffer.from('Login successful');
  }

  async charge(stub, args) {
    if (args.length != 2) {
        throw new Error('Incorrect number of arguments. Expecting 2');
    }

    let userId = args[0];
    let amount = parseInt(args[1]);

    if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid charge amount');
    }

    let userBytes = await stub.getState(userId);
    if (!userBytes || userBytes.length === 0) {
        throw new Error('User not found');
    }

    let user = JSON.parse(userBytes.toString());
    let adminBytes = await stub.getState("Admin");
    if (!adminBytes || adminBytes.length === 0) {
        throw new Error('Admin account not found');
    }

    let admin = JSON.parse(adminBytes.toString());

    if (user.account_money < amount) {
        throw new Error('Insufficient funds in user account');
    }

    if (admin.point < amount) {
        throw new Error('Insufficient points in admin account');
    }

    user.account_money -= amount;
    user.point += amount;
    admin.account_money += amount;
    admin.point -= amount;

    await stub.putState(userId, Buffer.from(JSON.stringify(user)));
    await stub.putState("Admin", Buffer.from(JSON.stringify(admin)));

    console.info(`Charged ${amount} from ${userId}`);
  }

  async exchange(stub, args) {
    if (args.length != 2) {
        return shim.error('Incorrect number of arguments. Expecting 2');
    }

    let userId = args[0].trim();
    let amount = parseInt(args[1].trim());

    if (isNaN(amount) || amount <= 0) {
        throw new Error('Expecting positive integer value for amount');
    }

    let userBytes = await stub.getState(userId);
    if (!userBytes || userBytes.length === 0) {
        throw new Error('User not found');
    }

    let user = JSON.parse(userBytes.toString());

    let adminBytes = await stub.getState('Admin');
    let admin = JSON.parse(adminBytes.toString());

    if (user.point < amount) {
        throw new Error('Insufficient points in user account');
    }

    user.point -= amount;
    admin.point += amount;

    let exchangeAmount = amount * 0.9;

    if (admin.account_Money < exchangeAmount) {
        throw new Error('Insufficient funds in admin account');
    }

    user.account_money += exchangeAmount;
    admin.account_money -= exchangeAmount;

    await stub.putState(userId, Buffer.from(JSON.stringify(user)));
    await stub.putState('Admin', Buffer.from(JSON.stringify(admin)));

    console.info(`Exchanged ${amount} points for user ${userId}`);
  }

  async transfer(stub, args) {
    if (args.length != 3) {
      throw new Error('Incorrect number of arguments. Expecting 3');
    }

    let sender = args[0];
    let receiver = args[1];
    let amount = parseInt(args[2]);

    // 90% transfer plus
    let transferAmount = amount * 0.9;
    let fee = amount - transferAmount;

    if (isNaN(transferAmount) || transferAmount <= 0) {
      throw new Error('Expecting positive integer value for transfer amount');
    }

    let senderBalanceBytes = await stub.getState(sender);
    if (!senderBalanceBytes || senderBalanceBytes.length === 0) {
      throw new Error('Failed to get state of sender');
    }
    let senderBalance = parseInt(senderBalanceBytes.toString());

    let receiverBalanceBytes = await stub.getState(receiver);
    if (!receiverBalanceBytes || receiverBalanceBytes.length === 0) {
      throw new Error('Failed to get state of receiver');
    }
    let receiverBalance = parseInt(receiverBalanceBytes.toString());

    if (senderBalance < amount) {
      throw new Error('Sender does not have enough balance');
    }

    let AdminBalanceBytes = await stub.getState("Admin");
    if (!AdminBalanceBytes || AdminBalanceBytes.length === 0) {
      throw new Error('Failed to get state of Admin');
    }
    let AdminBalance = parseInt(AdminBalanceBytes.toString());
    if (isNaN(AdminBalance)) {
      throw new Error('Admin balance is not a valid number');
    }

    AdminBalance += fee;
    senderBalance -= amount;
    receiverBalance += transferAmount;

    await stub.putState(sender, Buffer.from(senderBalance.toString()));
    await stub.putState(receiver, Buffer.from(receiverBalance.toString()));
    await stub.putState("Admin", Buffer.from(AdminBalance.toString()));

    console.info(`Transferred ${transferAmount} (90% of ${amount}) from ${sender} to ${receiver}`);
  }

  // Deletes an entity from state
  async delete(stub, args) {
    if (args.length != 1) {
      throw new Error('Incorrect number of arguments. Expecting 1');
    }

    let A = args[0];

    // Delete the key from the state in ledger
    await stub.deleteState(A);
  }

  async query(stub, args) {
    if (args.length != 1) {
      throw new Error('Incorrect number of arguments. Expecting name of the person to query');
    }

    let jsonResp = {};
    let A = args[0];

    // Get the state from the ledger
    let Avalbytes = await stub.getState(A);
    if (!Avalbytes) {
      jsonResp.error = 'Failed to get state for ' + A;
      throw new Error(JSON.stringify(jsonResp));
    }

     // Parse the JSON object
     let adminAccount = JSON.parse(Avalbytes.toString());

     // Return only specific fields
     let response = {
       id: adminAccount.id,
       point: adminAccount.point,
       account_Number: adminAccount.account_number,
       account_Money: adminAccount.account_money
     };

    jsonResp.name = A;
    jsonResp.amount = Avalbytes.toString();
    console.info('Query Response:');
    console.info(jsonResp);
    console.info(response);
    return Avalbytes;
  }
};

shim.start(new ABstore());
