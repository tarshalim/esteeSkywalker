import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import './Navbar.css';

function BasicExample() {
    return (
        <>
        <Navbar expand="lg" className="bg-body-tertiary">
        <Container>
            <Navbar.Brand as={Link} to="/home">EsteeSkywalker</Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="mx-auto">
                <Nav.Link as={Link} to="/home">Home</Nav.Link>
                <Nav.Link as={Link} to="/maps">Game</Nav.Link>
            </Nav>
            <Nav className="ms-auto">
                <NavDropdown title="Country"
                    id="basic-nav-dropdown">

                        <NavDropdown.Item>
                            Singapore
                        </NavDropdown.Item>
                        <NavDropdown.Item>
                            New Zealand
                        </NavDropdown.Item>
                        <NavDropdown.Item>
                            Europe
                        </NavDropdown.Item>
                        <NavDropdown.Item>
                            India
                        </NavDropdown.Item>
                </NavDropdown>
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    </>
    );
}

export default BasicExample;