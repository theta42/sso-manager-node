var express = require('express');
var router = express.Router();
const {InviteToken} = require('./../models/token');

/* GET home page. */
router.get('/', async function(req, res, next) {
  res.render('home', { title: 'Express' });
});

/* GET home page. */
router.get('/users', function(req, res, next) {
  res.render('users', { title: 'Express' });
});

router.get('/login/invite/:token', async function(req, res, next){
	try{
		console.log('token', req.params.token)
		let token = await InviteToken.get(req.params.token);
		console.log('invite', token);
		if(token.is_valid){
  			res.render('invite', { title: 'Express', invite: token });
		}else{
			next({status: 404});
		}
	}catch(error){
		next(error);
	}
});

/* GET home page. */
router.get('/login', function(req, res, next) {
  res.render('login', {redirect: req.query.redirect});
});

module.exports = router;
