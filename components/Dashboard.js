'use strict';

const React = require('react');

class Dashboard extends React.Component {
  constructor (props) {
    super(props);

    this.state = {
      status: 'INITIALIZED'
    };

    return this;
  }

  render () {
    return (
      <div className="dashboard">
        <h1>Dashboard</h1>
        <p>Nothing to see here.</p>
      </div>
    );
  }
}

module.exports = Dashboard;
