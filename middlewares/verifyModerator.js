const verifyModerator = (usersCollection) => {
    return async (req, res, next) => {
      const email = req.user.email;
      
      const user = await usersCollection.findOne({ email });
      
      if (user?.role !== 'Moderator' && user?.role !== 'Admin') {
        return res.status(403).send({ message: 'Forbidden access - Moderator or Admin only' });
      }
      
      next();
    };
  };
  
  module.exports = verifyModerator;
  