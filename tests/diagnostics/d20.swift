enum E: Error { case bad }
func risky() throws { throw E.bad }
risky()
