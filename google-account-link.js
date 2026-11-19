'use strict';
// Pure functions for security-critical account binding. Google sub, not email,
// is the stable identity; no implicit account merge and no duplicate linking.
function findByGoogleSub(users,sub){
 return Object.entries(users).find(([,u])=>u?.googleSub===sub)||null;
}
function googleLinkDecision(users,userKey,googleSub){
 const user=users[userKey];
 if(!user)return {ok:false,reason:'account_not_found'};
 const existing=findByGoogleSub(users,googleSub);
 if(existing&&existing[0]!==userKey)return {ok:false,reason:'google_already_linked'};
 if(user.googleSub&&user.googleSub!==googleSub)return {ok:false,reason:'account_already_linked'};
 return {ok:true,alreadyLinked:Boolean(user.googleSub===googleSub)};
}
module.exports={findByGoogleSub,googleLinkDecision};
