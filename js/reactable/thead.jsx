import React from 'react';
import { filterInternalProps } from './utils.jsx';

export class Thead extends React.Component {
  static getColumns(component) {
    // Can't use React.Children.map since that doesn't return a proper array
    let columns = [];
    React.Children.forEach(component.props.children, th => {
      if (typeof th.props.children === 'string') {
        columns.push(th.props.children);
      } else if (typeof th.props.column === 'string') {
        columns.push({
          key: th.props.column,
          label: th.props.children,
          props: filterInternalProps(th.props)
        });
      } else {
        throw new TypeError(
          '<th> must have either a "column" property or a string ' +
          'child');
      }
    });

    return columns;
  }

  handleClickTh(column) {
    this.props.onSort(column.key);
  }

  render() {
    var ths = [];
    for (var index = 0; index < this.props.columns.length; index++) {
      var column = this.props.columns[index];
      var thClass = `reactable-th-${column.key.replace(/\s+/g, '-').toLowerCase()}`;
      var sortClass = '';

      if (this.props.sortableColumns[column.key]) {
        sortClass += 'reactable-header-sortable ';
      }

      if (this.props.sort.column === column.key) {
        sortClass += 'reactable-header-sort';
        if (this.props.sort.direction === 1) {
          sortClass += '-asc';
        } else {
          sortClass += '-desc';
        }
      }

      if (sortClass.length > 0) {
        thClass += ` ${sortClass}`;
      }

      if (
        typeof (column.props) === 'object' &&
        typeof (column.props.className) === 'string'
      ) {
        thClass += ` ${column.props.className}`;
      }

      // TODO: not sure if filtering is needed
      const columnProps = filterInternalProps(column.props);
      ths.push(
        <th {...columnProps}
          className={ thClass }
          key={ index }
          onClick={ this.handleClickTh.bind(this, column) }
          role="button"
          tabIndex="0">
          { column.label }
        </th>
      );
    }

    // Manually transfer props
    var props = filterInternalProps(this.props);

    return (
      <thead {...props}>
        <tr className="reactable-column-header">
          { ths }
        </tr>
      </thead>
      );
  }
}
