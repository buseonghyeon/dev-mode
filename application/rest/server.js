const express = require('express');
const path = require('path');
const Nano = require('nano');
const multer = require('multer');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const sdk = require('./sdk');

const app = express();
const upload = multer({ dest: 'uploads/' });

const nano = Nano({
  url: 'http://admin:adminpw@localhost:5984',
  parseUrl: false
});

const userDbName = 'channel1_abstore';
const musicDbName = 'music_database';
const userDb = nano.db.use(userDbName);
const musicDb = nano.db.use(musicDbName);

async function createDBs() {
  try {
    await nano.db.create(userDbName);
    console.log(`Database '${userDbName}' created successfully.`);
  } catch (error) {
    if (error.statusCode === 412) {
      console.log(`Database '${userDbName}' already exists.`);
    } else {
      console.error('Error creating user database:', error);
    }
  }

  try {
    await nano.db.create(musicDbName);
    console.log(`Database '${musicDbName}' created successfully.`);
  } catch (error) {
    if (error.statusCode === 412) {
      console.log(`Database '${musicDbName}' already exists.`);
    } else {
      console.error('Error creating music database:', error);
    }
  }
}

async function createDesignDoc() {
  const designDoc = {
    _id: '_design/song_views',
    views: {
      by_songName: {
        map: function (doc) {
          if (doc.type === 'song' && doc.songName) {
            emit(doc.songName, doc);
          }
        }.toString()
      },
      by_user: {
        map: function (doc) {
          if (doc.type === 'song' && doc.userID) {
            emit(doc.userID, doc);
          }
        }.toString()
      }
    }
  };

  try {
    await musicDb.insert(designDoc);
    console.log('Design document created successfully in music database.');
  } catch (error) {
    if (error.statusCode === 409) {
      console.log('Design document already exists in music database.');
    } else {
      console.error('Error creating design document in music database:', error);
    }
  }
}

function generateUniqueId(prefix) {
  return `${prefix}:${crypto.randomBytes(16).toString('hex')}`;
}

const PORT = 8001;
const HOST = '0.0.0.0';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../client')));

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


app.post('/register', async function (req, res) {
  let name = req.body.name;
  let id = req.body.id;
  let pw = req.body.pw;
  let phone_number = req.body.phone_number;
  let account_number = req.body.account_number;
  let account_money = parseInt(req.body.account_money);

  const user = {
    _id: id,
    type: 'user',
    name,
    pw,
    phone_number,
    account_number,
    account_money,
    point: 1000
  };

  try {
    // Fetch admin account
    let adminBytes = await userDb.get('Admin');
    console.log('Fetched admin account:', adminBytes);

    let admin = adminBytes;  // adminBytes가 이미 객체인 경우 JSON.parse 필요 없음
    console.log('Admin account:', admin);

    // Check if admin has enough points
    if (admin.point < 1000) {
      return res.status(400).json({ error: 'Admin 계정의 포인트가 부족합니다.' });
    }

    // Deduct points from admin
    admin.point -= 1000;
    console.log('Admin account after point deduction:', admin);

    // Save the updated admin account
    await userDb.insert({ ...admin, _rev: admin._rev });
    console.log('Admin account updated successfully');

    // Register the new user
    await userDb.insert(user);
    console.log('User registered successfully');

    res.status(200).json({ message: '회원가입이 성공적으로 완료되었습니다.', success: true });
  } catch (error) {
    if (error.statusCode === 409) {
      // Document update conflict, try to get the latest revision and retry
      try {
        let latestAdminBytes = await userDb.get('Admin');
        let latestAdmin = latestAdminBytes;
        console.log('Fetched latest admin account:', latestAdmin);

        // Deduct points from latest admin account
        latestAdmin.point -= 1000;
        console.log('Latest admin account after point deduction:', latestAdmin);

        // Save the updated latest admin account
        await userDb.insert({ ...latestAdmin, _rev: latestAdmin._rev });
        console.log('Latest admin account updated successfully');

        // Register the new user
        await userDb.insert(user);
        console.log('User registered successfully after conflict resolution');

        return res.status(200).json({ message: '회원가입이 성공적으로 완료되었습니다.', success: true });
      } catch (retryError) {
        console.error('Error during conflict resolution:', retryError);
        return res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.', details: retryError.message });
      }
    } else {
      console.error('Error registering user:', error);
      return res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.', details: error.message });
    }
  }
});


app.post('/login', async function (req, res) {
  let { userId, userPw } = req.body;

  console.log(`Login attempt for user ID: ${userId} with password: ${userPw}`);

  try {
    if (!userId || !userPw) {
      throw new Error('Invalid parameters');
    }

    const user = await userDb.get(userId);
    if (user && user.pw === userPw) {
      console.log('Login successful');
      res.status(200).json({ success: true, user });
    } else {
      console.log('Login failed: Incorrect password');
      res.status(401).json({ success: false, message: '로그인 실패: 아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ success: false, message: '로그인 중 오류가 발생했습니다.', details: error.message });
  }
});

app.post('/deleteUser', async function (req, res) {
  let { userId } = req.body;

  try {
    const user = await userDb.get(userId);
    if (user) {
      await userDb.destroy(user._id, user._rev);
      console.log(`User ${userId} deleted successfully.`);
      res.status(200).json({ success: true, message: 'User deleted successfully.' });
    } else {
      console.log(`User ${userId} not found.`);
      res.status(404).json({ success: false, message: 'User not found.' });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: 'Error deleting user.', details: error.message });
  }
});

app.post('/transfer', async function (req, res) {
  const { senderID, songName } = req.body;

  try {
    const body = await musicDb.view('song_views', 'by_songName', { key: songName });

    if (body.rows.length === 0) {
      return res.status(404).json({ error: '해당 음원이 존재하지 않습니다.' });
    }

    const song = body.rows[0].value;
    const receiverID = senderID; // 수신자는 현재 로그인한 사용자

    if (song.userID === receiverID) {
      return res.status(400).json({ error: '자신의 음원을 거래할 수 없습니다.' });
    }

    const sender = await userDb.get(song.userID);
    const receiver = await userDb.get(receiverID);
    const admin = await userDb.get('Admin');

    if (!sender || !receiver || !admin) {
      return res.status(404).json({ error: '송신자, 수신자 또는 관리자 계정이 존재하지 않습니다.' });
    }

    const price = song.price;
    const transferAmount = Math.floor(price * 0.9);
    const adminAmount = price - transferAmount;

    if (receiver.point < price) {
      return res.status(400).json({ error: '수신자의 포인트가 부족합니다.' });
    }

    receiver.point -= price;
    sender.point += transferAmount;
    admin.point += adminAmount;
    song.userID = receiverID;

    await userDb.insert(sender);
    await userDb.insert(receiver);
    await userDb.insert(admin);
    await musicDb.insert(song);

    res.status(200).json({ success: true, message: '음원 거래가 성공적으로 완료되었습니다.' });
  } catch (error) {
    console.error('Error during transfer:', error);
    res.status(500).json({ success: false, error: '음원 거래 중 오류가 발생했습니다.', details: error.message });
  }
});

app.post('/charge', async function (req, res) {
  let { userId, amount } = req.body; // 요청 본문에서 userId와 amount를 추출

  try {
    const user = await userDb.get(userId);
    const admin = await userDb.get('Admin');

    amount = parseInt(amount);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    if (user.account_money < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient funds in user account' });
    }

    if (admin.point < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient points in admin account' });
    }

    user.account_money -= amount;
    user.point += amount;
    admin.account_money += amount;
    admin.point -= amount;

    await userDb.insert(user);
    await userDb.insert(admin);

    console.log(`Charged ${amount} from ${userId}`);
    res.status(200).json({ success: true, message: 'Charged successfully' });
  } catch (error) {
    console.error('Error during charge:', error);
    res.status(500).json({ success: false, message: 'Error during charge', details: error.message });
  }
});

app.post('/exchange', async function (req, res) {
  let { userId, amount } = req.body;

  try {
    const user = await userDb.get(userId);
    const admin = await userDb.get('Admin');

    amount = parseInt(amount);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    if (user.point < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient points in user account' });
    }

    let exchangeAmount = amount * 0.9;

    if (admin.account_money < exchangeAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient funds in admin account' });
    }

    user.point -= amount;
    user.account_money += exchangeAmount;
    admin.account_money -= exchangeAmount;
    admin.point += amount;

    await userDb.insert(user);
    await userDb.insert(admin);

    console.log(`Exchanged ${amount} points for ${exchangeAmount} from ${userId}`);
    res.status(200).json({ success: true, message: 'Exchanged successfully' });
  } catch (error) {
    console.error('Error during exchange:', error);
    res.status(500).json({ success: false, message: 'Error during exchange', details: error.message });
  }
});

app.get('/query', async function (req, res) {
  let userId = req.query.name;
  console.log(`Fetching data for user ID: ${userId}`);

  try {
    const user = await userDb.get(userId);
    if (user) {
      console.log(`User data: ${JSON.stringify(user)}`);
      res.status(200).json(user);
    } else {
      console.log('User not found');
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Error fetching user data', details: error.message });
  }
});

app.get('/userSongs', async function (req, res) {
  const userID = req.query.userID;

  try {
    const body = await musicDb.view('song_views', 'by_user', { key: userID });
    const songs = body.rows.map(row => row.value);
    res.status(200).json(songs);
  } catch (error) {
    console.error('Error fetching user songs:', error);
    res.status(500).json({ error: 'Error fetching user songs' });
  }
});


app.post('/registerMusic', upload.fields([{ name: 'audioFile', maxCount: 1 }, { name: 'imageFile', maxCount: 1 }]), async function (req, res) {
  try {
    if (!req.files || !req.files['audioFile'] || !req.files['imageFile']) {
      throw new Error('Files are not properly uploaded');
    }

    const userId = req.body.userID;

    const user = await userDb.get(userId);
    if (!user) {
      return res.status(400).json({ error: '회원 ID가 유효하지 않습니다.' });
    }

    const song = {
      _id: `song:${userId}:${Date.now()}`,  // ID에 userID와 타임스탬프를 포함
      type: 'song',
      songName: req.body.songName,
      genre: req.body.genre,
      songInfo: req.body.songInfo,
      lyrics: req.body.lyrics,
      price: req.body.price,
      audioFile: path.join(__dirname, req.files['audioFile'][0].path),
      imageFile: path.join(__dirname, req.files['imageFile'][0].path),
      userID: userId
    };

    const response = await musicDb.insert(song);
    console.log('Document inserted:', response);

    res.status(200).json({ message: '음원 등록이 성공적으로 완료되었습니다.' });
  } catch (error) {
    console.error('Error inserting document:', error);
    if (error.statusCode === 404) {
      res.status(400).json({ error: '회원 ID가 유효하지 않습니다.' });
    } else {
      res.status(500).json({ error: '음원 등록 중 오류가 발생했습니다.', details: error.message });
    }
  }
});


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/deleteMusic', async function(req, res) {
  const { songId } = req.body;

  try {
    const song = await musicDb.get(songId);

    const response = await musicDb.destroy(song._id, song._rev);
    console.log('Document deleted:', response);

    res.status(200).json({ message: '음원이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('Error deleting document:', error);
    if (error.statusCode === 404) {
      res.status(404).json({ error: '음원이 존재하지 않습니다.' });
    } else {
      res.status(500).json({ error: '음원 삭제 중 오류가 발생했습니다.' });
    }
  }
});

app.get('/getSong', async function(req, res) {
  try {
    const songId = req.query.songId;
    const song = await musicDb.get(songId);
    res.status(200).json(song);
  } catch (error) {
    console.error('Error fetching song:', error);
    res.status(500).json({ error: 'Error fetching song' });
  }
});

app.post('/editMusic', upload.fields([{ name: 'audioFile', maxCount: 1 }, { name: 'imageFile', maxCount: 1 }]), async function(req, res) {
  try {
    const songId = req.body.songId;
    const song = await musicDb.get(songId);

    if (req.files && req.files['audioFile']) {
      song.audioFile = path.join(__dirname, req.files['audioFile'][0].path);
    }
    if (req.files && req.files['imageFile']) {
      song.imageFile = path.join(__dirname, req.files['imageFile'][0].path);
    }

    song.songName = req.body.songName;
    song.genre = req.body.genre;
    song.songInfo = req.body.songInfo;
    song.lyrics = req.body.lyrics;
    song.price = req.body.price;

    const response = await musicDb.insert(song);
    console.log('Document updated:', response);
    res.status(200).json({ message: '음원 수정이 성공적으로 완료되었습니다.' });
  } catch (error) {
    console.error('Error updating song:', error);
    res.status(500).json({ error: '음원 수정 중 오류가 발생했습니다.', details: error.message });
  }
});

app.get('/albums', async function (req, res) {
  try {
    const body = await musicDb.view('song_views', 'by_songName');
    const albums = body.rows.map(row => ({
      songName: row.value.songName,
      imageFile: row.value.imageFile,
      price: row.value.price
    }));
    res.status(200).json(albums);
  } catch (error) {
    console.error('Error fetching albums:', error);
    res.status500.json({ error: 'Error fetching albums' });
  }
});

createDBs().then(() => {
  return createDesignDoc();
}).then(() => {
  app.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
  });
}).catch(error => {
  console.error('Error setting up databases:', error);
});
