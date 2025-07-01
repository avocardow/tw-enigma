import { PostCssParser } from './syntaxValidator';

// Test valid CSS to see what our validation is flagging
const validCss = `
        .test {
          color: red;
          background: blue;
        }

        .another {
          margin: 10px;
          padding: 5px;
        }
      `;

const parser = new PostCssParser();

// Run validation and log the results
parser
  .validateSyntax(validCss)
  .then((errors) => {
    console.log('Errors found in valid CSS:', errors);
    console.log('Number of errors:', errors.length);

    errors.forEach((error, i) => {
      console.log(`Error ${i + 1}:`, {
        type: error.type,
        message: error.message,
        line: error.line,
        source: error.source,
        code: error.code,
      });
    });
  })
  .catch(console.error);
